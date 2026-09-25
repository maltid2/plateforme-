//+------------------------------------------------------------------+
//|                                                  GeometryDow.mq5 |
//|  Robot de trading — méthode « Geometry Market Mastery »          |
//|  Dow Jones (US30), zones M15 + confirmation M5.                  |
//|                                                                  |
//|  Check-list appliquée à chaque clôture de bougie M5 :            |
//|   1. Type de trade : range ou impulsion  -> taille du stop       |
//|   2. Zone clé M15 : supply / demand      -> où entrer            |
//|   3. Géométrie de marché AB=CD, U, N     -> target               |
//|   4. Mèches de rejet M15 dans la zone    -> polarité             |
//|   5. 2 bougies M5 dans le sens + volume  -> entrée               |
//|  + garde-fous psychologiques (pause après perte, 2 h max/jour,   |
//|    pas de renfort, stop jamais élargi, stop suiveur).            |
//|                                                                  |
//|  Même logique que le backtester Node.js (../backtest).           |
//+------------------------------------------------------------------+
#property copyright "plateforme-"
#property version   "1.00"
#property description "Geometry Market Mastery — Dow Jones M15/M5"

#include <Trade\Trade.mqh>

//--- Toutes les distances sont en POINTS D'INDICE (1 point Dow = InpIndexPoint en prix)
input group "Instrument"
input double InpIndexPoint            = 1.0;     // Valeur d'1 point d'indice en prix
input long   InpMagic                 = 25092026;

input group "Horaires (heure de Paris)"
input int    InpServerMinusParisHours = 1;       // Heure serveur - heure de Paris
input string InpSession1              = "10:00-13:30";
input string InpSession2              = "18:00-20:00";
input string InpSession3              = "21:30-23:00";
input int    InpMaxMinutesAfterFirst  = 120;     // Trader max 2 h puis arrêter

input group "1. Type de trade"
input int    InpRegimeLookback        = 24;      // Bougies M15 analysées
input double InpRangeEfficiencyMax    = 0.3;     // Efficacité < seuil => range
input double InpRangeMinSL            = 5;       // SL mini range serré
input double InpWideRangeSize         = 100;     // Amplitude d'un range « large »
input double InpWideRangeMinSL        = 30;      // SL mini range large
input double InpImpulseMinSL          = 20;      // SL mini impulsion
input double InpMaxSL                 = 40;      // Au-delà : pas de trade
input double InpSLBuffer              = 2;       // Marge derrière les mèches

input group "2. Zones clés M15"
input int    InpPivotStrength         = 2;
input int    InpZoneLookback          = 96;      // 96 x M15 = 24 h
input double InpMinZoneHeight         = 4;
input double InpZoneTolerance         = 3;

input group "3. Géométrie de marché"
input double InpABCDMin               = 0.75;
input double InpABCDMax               = 1.3;
input bool   InpRequireGeometry       = false;   // N'entrer que si AB=CD complété
input double InpTargetMargin          = 2;
input double InpMinRR                 = 1.5;

input group "4. Mèches de rejet M15"
input int    InpWickLookback          = 3;
input double InpWickRatio             = 0.4;
input double InpBigWickRatio          = 0.6;
input int    InpMinWicks              = 1;
input bool   InpRequireStopHunt       = false;

input group "5. Confirmation M5"
input int    InpVolumeMaPeriod        = 20;
input double InpVolumeFactor          = 1.0;
input double InpMaxEntryDistance      = 15;      // Pas d'entrée sur une accélération

input group "Mode achat/vente rapide"
input bool   InpQuickMode             = false;   // SL/TP fixes
input double InpQuickSL               = 5;
input double InpQuickTP               = 30;

input group "Gestion de position"
input double InpBreakEvenAtR          = 1.0;
input double InpBreakEvenLock         = 1;
input bool   InpTrailing              = true;

input group "Money management & psychologie"
input double InpRiskPercent           = 1.0;
input int    InpMaxTradesPerDay       = 3;
input int    InpMaxLossesPerDay       = 2;
input int    InpPauseAfterLossMinutes = 120;
input double InpMaxDailyLossPercent   = 3;

input group "Affichage"
input bool   InpDrawZones             = true;

//--- Structures
struct Zone   { int side; double bottom; double top; int pivotIdx; }; // side : +1 demand, -1 supply
struct Pivot  { int idx; int kind; double price; };                   // kind : +1 haut, -1 bas
struct Regime { bool isRange; double efficiency; double high; double low; double minSL; };
struct Reject { int count; double extreme; bool stopHunt; bool engulf; int firstIdx; };
struct Geo    { bool found; double ab; double cd; double ratio; bool complete; };

CTrade   trade;
datetime g_lastBar = 0;
int      g_sessStart[3], g_sessEnd[3];
double   g_pt;

//+------------------------------------------------------------------+
int ParseHM(string s)
  {
   string p[];
   if(StringSplit(s, ':', p) != 2) return -1;
   return (int)StringToInteger(p[0]) * 60 + (int)StringToInteger(p[1]);
  }

bool ParseSession(string s, int &a, int &b)
  {
   string p[];
   if(StringSplit(s, '-', p) != 2) { a = -1; b = -1; return s == ""; }
   a = ParseHM(p[0]); b = ParseHM(p[1]);
   return a >= 0 && b > a;
  }

int OnInit()
  {
   if(!ParseSession(InpSession1, g_sessStart[0], g_sessEnd[0]) ||
      !ParseSession(InpSession2, g_sessStart[1], g_sessEnd[1]) ||
      !ParseSession(InpSession3, g_sessStart[2], g_sessEnd[2]))
     {
      Print("Session invalide : format attendu HH:MM-HH:MM");
      return INIT_PARAMETERS_INCORRECT;
     }
   g_pt = InpIndexPoint;
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetDeviationInPoints(30);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, "GDZ_");
   Comment("");
  }

//+------------------------------------------------------------------+
//| Temps                                                            |
//+------------------------------------------------------------------+
long ParisMinutesTotal(datetime t) { return (long)t / 60 - InpServerMinusParisHours * 60; }
int  ParisMinuteOfDay(datetime t)  { long m = ParisMinutesTotal(t); return (int)(((m % 1440) + 1440) % 1440); }
long ParisDay(datetime t)          { long m = ParisMinutesTotal(t); return (m >= 0) ? m / 1440 : (m - 1439) / 1440; }
datetime ParisDayStartServer(datetime t) { return (datetime)((ParisDay(t) * 1440 + InpServerMinusParisHours * 60) * 60); }

bool InSession(datetime t)
  {
   int m = ParisMinuteOfDay(t);
   for(int k = 0; k < 3; k++)
      if(g_sessStart[k] >= 0 && m >= g_sessStart[k] && m < g_sessEnd[k]) return true;
   return false;
  }

//+------------------------------------------------------------------+
//| Bougies                                                          |
//+------------------------------------------------------------------+
bool   Bull(const MqlRates &b)  { return b.close > b.open; }
bool   Bear(const MqlRates &b)  { return b.close < b.open; }
double LowerWick(const MqlRates &b) { return MathMin(b.open, b.close) - b.low; }
double UpperWick(const MqlRates &b) { return b.high - MathMax(b.open, b.close); }

//+------------------------------------------------------------------+
//| Étape 1 : range ou impulsion                                     |
//+------------------------------------------------------------------+
Regime DetectRegime(const MqlRates &m[], int last)
  {
   Regime r;
   int from = MathMax(1, last - InpRegimeLookback + 1);
   double path = 0; r.high = -DBL_MAX; r.low = DBL_MAX;
   for(int k = from; k <= last; k++)
     {
      path  += MathAbs(m[k].close - m[k - 1].close);
      r.high = MathMax(r.high, m[k].high);
      r.low  = MathMin(r.low, m[k].low);
     }
   r.efficiency = path > 0 ? MathAbs(m[last].close - m[from - 1].close) / path : 0;
   r.isRange = r.efficiency < InpRangeEfficiencyMax;
   if(!r.isRange) r.minSL = InpImpulseMinSL * g_pt;
   else r.minSL = (r.high - r.low >= InpWideRangeSize * g_pt ? InpWideRangeMinSL : InpRangeMinSL) * g_pt;
   return r;
  }

//+------------------------------------------------------------------+
//| Étape 2 : pivots et zones supply/demand                          |
//+------------------------------------------------------------------+
int FindPivots(const MqlRates &m[], int last, Pivot &out[])
  {
   ArrayResize(out, 0);
   int s = InpPivotStrength;
   int from = MathMax(s, last - InpZoneLookback);
   for(int j = from; j <= last - s; j++)
     {
      bool hi = true, lo = true;
      for(int k = 1; k <= s; k++)
        {
         if(!(m[j].high > m[j - k].high && m[j].high >= m[j + k].high)) hi = false;
         if(!(m[j].low  < m[j - k].low  && m[j].low  <= m[j + k].low))  lo = false;
        }
      if(hi) { int n = ArraySize(out); ArrayResize(out, n + 1); out[n].idx = j; out[n].kind =  1; out[n].price = m[j].high; }
      if(lo) { int n = ArraySize(out); ArrayResize(out, n + 1); out[n].idx = j; out[n].kind = -1; out[n].price = m[j].low;  }
     }
   return ArraySize(out);
  }

int BuildZones(const MqlRates &m[], int last, const Pivot &pv[], Zone &out[])
  {
   ArrayResize(out, 0);
   double tol = InpZoneTolerance * g_pt, h = InpMinZoneHeight * g_pt;
   for(int p = 0; p < ArraySize(pv); p++)
     {
      Zone z; int j = pv[p].idx; z.pivotIdx = j;
      if(pv[p].kind < 0) { z.side =  1; z.bottom = m[j].low;  z.top = MathMax(MathMin(m[j].open, m[j].close), m[j].low + h); }
      else               { z.side = -1; z.top    = m[j].high; z.bottom = MathMin(MathMax(m[j].open, m[j].close), m[j].high - h); }
      // Cassée seulement sur CLÔTURE au-delà (une mèche = stop hunt)
      bool broken = false;
      for(int k = j + 1; k <= last && !broken; k++)
        {
         if(z.side > 0 && m[k].close < z.bottom - tol) broken = true;
         if(z.side < 0 && m[k].close > z.top + tol)    broken = true;
        }
      if(!broken) { int n = ArraySize(out); ArrayResize(out, n + 1); out[n] = z; }
     }
   return ArraySize(out);
  }

int ZigZag(const Pivot &pv[], Pivot &zz[])
  {
   ArrayResize(zz, 0);
   for(int p = 0; p < ArraySize(pv); p++)  // pv est déjà trié par index
     {
      int n = ArraySize(zz);
      if(n > 0 && zz[n - 1].kind == pv[p].kind)
        {
         if((pv[p].kind > 0 && pv[p].price > zz[n - 1].price) || (pv[p].kind < 0 && pv[p].price < zz[n - 1].price))
            zz[n - 1] = pv[p];
        }
      else { ArrayResize(zz, n + 1); zz[n] = pv[p]; }
     }
   return ArraySize(zz);
  }

//+------------------------------------------------------------------+
//| Étape 3 : géométrie AB=CD                                        |
//+------------------------------------------------------------------+
Geo Geometry(const Pivot &zz[], int dir, double dPrice, int beforeIdx)
  {
   Geo g; g.found = false; g.complete = false; g.ab = 0; g.cd = 0; g.ratio = 0;
   // Achat : A haut, B bas, C haut (D = bas actuel). Vente : l'inverse.
   int n = 0; Pivot pts[];
   for(int k = 0; k < ArraySize(zz); k++)
      if(zz[k].idx < beforeIdx) { ArrayResize(pts, n + 1); pts[n++] = zz[k]; }
   for(int k = n - 1; k >= 2; k--)
     {
      if(pts[k - 2].kind != dir || pts[k - 1].kind != -dir || pts[k].kind != dir) continue;
      g.found = true;
      g.ab = MathAbs(pts[k - 2].price - pts[k - 1].price);
      g.cd = MathAbs(pts[k].price - dPrice);
      g.ratio = g.ab > 0 ? g.cd / g.ab : 0;
      g.complete = g.ratio >= InpABCDMin && g.ratio <= InpABCDMax;
      break;
     }
   return g;
  }

//+------------------------------------------------------------------+
//| Étape 4 : mèches de rejet M15                                    |
//+------------------------------------------------------------------+
bool Rejection(const MqlRates &m[], int last, const Zone &z, int dir, Reject &r)
  {
   double tol = InpZoneTolerance * g_pt;
   int from = MathMax(z.pivotIdx + InpPivotStrength + 1, last - InpWickLookback + 1);
   r.count = 0; r.engulf = false; r.firstIdx = -1;
   r.extreme = dir > 0 ? DBL_MAX : -DBL_MAX;
   for(int k = from; k <= last; k++)
     {
      double rg = m[k].high - m[k].low;
      if(rg <= 0) continue;
      bool same = false, eng = false;
      if(dir > 0)
        {
         if(!(m[k].low <= z.top + tol && m[k].close >= z.bottom)) continue;
         same = Bull(m[k]) && LowerWick(m[k]) / rg >= InpWickRatio;
         eng  = k + 1 <= last && Bear(m[k]) && LowerWick(m[k]) / rg >= InpBigWickRatio && Bull(m[k + 1]) && m[k + 1].close > m[k].open;
        }
      else
        {
         if(!(m[k].high >= z.bottom - tol && m[k].close <= z.top)) continue;
         same = Bear(m[k]) && UpperWick(m[k]) / rg >= InpWickRatio;
         eng  = k + 1 <= last && Bull(m[k]) && UpperWick(m[k]) / rg >= InpBigWickRatio && Bear(m[k + 1]) && m[k + 1].close < m[k].open;
        }
      if(!same && !eng) continue;
      if(r.firstIdx < 0) r.firstIdx = k;
      r.count++;
      if(eng && !same) r.engulf = true;
      r.extreme = dir > 0 ? MathMin(r.extreme, m[k].low) : MathMax(r.extreme, m[k].high);
     }
   if(r.count < InpMinWicks) return false;
   r.stopHunt = dir > 0 ? r.extreme < z.bottom : r.extreme > z.top;
   return true;
  }

//+------------------------------------------------------------------+
//| Étape 5 : confirmation M5                                        |
//+------------------------------------------------------------------+
bool ConfirmM5(const MqlRates &m[], int i, int dir, double &lo, double &hi)
  {
   if(i < 2) return false;
   int from = MathMax(0, i - InpVolumeMaPeriod - 1), to = i - 2;
   if(to < from) return false;
   double avg = 0;
   for(int k = from; k <= to; k++) avg += (double)m[k].tick_volume;
   avg /= (to - from + 1);
   double v1 = (double)m[i - 1].tick_volume, v2 = (double)m[i].tick_volume;
   bool volOk = v1 >= avg * InpVolumeFactor && v2 >= avg * InpVolumeFactor;
   bool ok = dir > 0 ? (Bull(m[i - 1]) && Bull(m[i]) && m[i].close > m[i - 1].close)
                     : (Bear(m[i - 1]) && Bear(m[i]) && m[i].close < m[i - 1].close);
   lo = MathMin(m[i - 1].low, m[i].low);
   hi = MathMax(m[i - 1].high, m[i].high);
   return ok && volOk;
  }

//+------------------------------------------------------------------+
//| Garde-fous psychologiques (recalculés depuis l'historique)       |
//+------------------------------------------------------------------+
string GuardBlock(datetime now)
  {
   datetime dayStart = ParisDayStartServer(now);
   if(!HistorySelect(dayStart, now + 60)) return "historique indisponible";
   int trades = 0, losses = 0; double pnl = 0; datetime first = 0, lastLoss = 0;
   for(int k = 0; k < HistoryDealsTotal(); k++)
     {
      ulong d = HistoryDealGetTicket(k);
      if(HistoryDealGetInteger(d, DEAL_MAGIC) != InpMagic || HistoryDealGetString(d, DEAL_SYMBOL) != _Symbol) continue;
      long entry = HistoryDealGetInteger(d, DEAL_ENTRY);
      datetime t = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
      if(entry == DEAL_ENTRY_IN) { trades++; if(first == 0 || t < first) first = t; }
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
        {
         double p = HistoryDealGetDouble(d, DEAL_PROFIT) + HistoryDealGetDouble(d, DEAL_SWAP) + HistoryDealGetDouble(d, DEAL_COMMISSION);
         pnl += p;
         if(p < 0) { losses++; if(t > lastLoss) lastLoss = t; }
        }
     }
   double startBalance = AccountInfoDouble(ACCOUNT_BALANCE) - pnl;
   double pnlPct = startBalance > 0 ? pnl / startBalance * 100.0 : 0;
   if(trades >= InpMaxTradesPerDay) return "max trades/jour";
   if(losses >= InpMaxLossesPerDay) return "max pertes/jour";
   if(pnlPct <= -InpMaxDailyLossPercent) return "perte journalière max";
   if(first > 0 && now - first > InpMaxMinutesAfterFirst * 60) return "2 h de trading écoulées";
   if(lastLoss > 0 && now - lastLoss < InpPauseAfterLossMinutes * 60) return "pause après perte";
   return "";
  }

//+------------------------------------------------------------------+
//| Taille de position selon le risque                               |
//+------------------------------------------------------------------+
double LotsForRisk(double slDist)
  {
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   if(tickValue <= 0 || tickSize <= 0 || slDist <= 0 || step <= 0) return 0;
   double money = AccountInfoDouble(ACCOUNT_BALANCE) * InpRiskPercent / 100.0;
   double lots = money / (slDist / tickSize * tickValue);
   lots = MathFloor(lots / step) * step;
   if(lots < vmin) return 0;  // le risque minimal dépasserait le risque autorisé
   return MathMin(lots, vmax);
  }

//+------------------------------------------------------------------+
//| Position ouverte par ce robot                                    |
//+------------------------------------------------------------------+
bool SelectOwnPosition()
  {
   for(int k = PositionsTotal() - 1; k >= 0; k--)
     {
      ulong t = PositionGetTicket(k);
      if(t > 0 && PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagic) return true;
     }
   return false;
  }

// Stop suiveur : ne fait QUE resserrer (jamais élargir le stop)
void ManagePosition(const MqlRates &bar)
  {
   if(!SelectOwnPosition()) return;
   ulong  ticket = (ulong)PositionGetInteger(POSITION_TICKET);
   int    dir    = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? 1 : -1;
   double entry  = PositionGetDouble(POSITION_PRICE_OPEN);
   double sl     = PositionGetDouble(POSITION_SL);
   double tp     = PositionGetDouble(POSITION_TP);
   // Risque initial mémorisé à l'ouverture (variable globale du terminal, puis commentaire)
   string key = "GDR_" + IntegerToString(PositionGetInteger(POSITION_IDENTIFIER));
   double risk = GlobalVariableCheck(key) ? GlobalVariableGet(key) : 0;
   string cmt = PositionGetString(POSITION_COMMENT);
   if(risk <= 0 && StringFind(cmt, "GDR:") == 0) risk = StringToDouble(StringSubstr(cmt, 4));
   if(risk <= 0) risk = MathAbs(entry - sl);
   if(risk <= 0) return;

   double profit = (bar.close - entry) * dir;
   if(profit < InpBreakEvenAtR * risk) return;
   double nsl = sl;
   double be = entry + dir * InpBreakEvenLock * g_pt;
   nsl = dir > 0 ? MathMax(nsl, be) : (nsl == 0 ? be : MathMin(nsl, be));
   if(InpTrailing)
     {
      double tr = bar.close - dir * risk;
      nsl = dir > 0 ? MathMax(nsl, tr) : MathMin(nsl, tr);
     }
   nsl = NormalizeDouble(nsl, _Digits);
   double stops = SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   double px = dir > 0 ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if((px - nsl) * dir <= stops) return;
   if((nsl - sl) * dir > _Point) trade.PositionModify(ticket, nsl, tp);
  }

//+------------------------------------------------------------------+
//| Dessin des zones                                                 |
//+------------------------------------------------------------------+
void DrawZones(const MqlRates &m[], const Zone &z[])
  {
   ObjectsDeleteAll(0, "GDZ_");
   if(!InpDrawZones) return;
   datetime t2 = TimeCurrent() + PeriodSeconds(PERIOD_M15) * 8;
   for(int k = 0; k < ArraySize(z); k++)
     {
      string name = "GDZ_" + IntegerToString(k);
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, m[z[k].pivotIdx].time, z[k].top, t2, z[k].bottom);
      ObjectSetInteger(0, name, OBJPROP_COLOR, z[k].side > 0 ? clrSeaGreen : clrIndianRed);
      ObjectSetInteger(0, name, OBJPROP_FILL, true);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
     }
  }

//+------------------------------------------------------------------+
//| Évaluation de la check-list et prise de position                 |
//+------------------------------------------------------------------+
void OnTick()
  {
   datetime bar0 = iTime(_Symbol, PERIOD_M5, 0);
   if(bar0 == 0 || bar0 == g_lastBar) return;
   g_lastBar = bar0;

   MqlRates m5[], m15[];
   ArraySetAsSeries(m5, false);
   ArraySetAsSeries(m15, false);
   // Bougies CLÔTURÉES uniquement (on commence à l'index 1)
   if(CopyRates(_Symbol, PERIOD_M5, 1, InpVolumeMaPeriod + 5, m5) < InpVolumeMaPeriod + 3) return;
   int need = MathMax(InpZoneLookback, InpRegimeLookback) + InpPivotStrength * 2 + 5;
   if(CopyRates(_Symbol, PERIOD_M15, 1, need, m15) < need) return;
   int i = ArraySize(m5) - 1, last = ArraySize(m15) - 1;

   ManagePosition(m5[i]);

   Regime reg = DetectRegime(m15, last);
   Pivot pv[], zz[]; Zone zones[];
   FindPivots(m15, last, pv);
   BuildZones(m15, last, pv, zones);
   ZigZag(pv, zz);
   DrawZones(m15, zones);

   string status = StringFormat("Geometry Dow | %s (eff. %.2f) | %d zones", reg.isRange ? "RANGE" : "IMPULSION", reg.efficiency, ArraySize(zones));
   if(SelectOwnPosition())          { Comment(status, "\nPosition en cours — pas de renfort"); return; }
   if(!InSession(bar0))             { Comment(status, "\nHors créneau horaire"); return; }
   string block = GuardBlock(TimeCurrent());
   if(block != "")                  { Comment(status, "\nPause : ", block); return; }
   Comment(status, "\nEn attente d'un setup...");

   double price = m5[i].close;
   for(int dir = 1; dir >= -1; dir -= 2)
     {
      double cLo, cHi;
      if(!ConfirmM5(m5, i, dir, cLo, cHi)) continue;

      // Zones du bon côté, triées de la plus proche à la plus éloignée
      int ownIdx[]; int n = 0;
      for(int k = 0; k < ArraySize(zones); k++)
         if(zones[k].side == dir) { ArrayResize(ownIdx, n + 1); ownIdx[n++] = k; }
      for(int a = 0; a < n; a++)
         for(int b = a + 1; b < n; b++)
           {
            double da = MathAbs(price - (zones[ownIdx[a]].top + zones[ownIdx[a]].bottom) / 2);
            double db = MathAbs(price - (zones[ownIdx[b]].top + zones[ownIdx[b]].bottom) / 2);
            if(db < da) { int t = ownIdx[a]; ownIdx[a] = ownIdx[b]; ownIdx[b] = t; }
           }

      for(int q = 0; q < n; q++)
        {
         Zone z = zones[ownIdx[q]];
         double edge = dir > 0 ? z.top : z.bottom;
         if((price - edge) * dir > InpMaxEntryDistance * g_pt) continue;
         if(dir > 0 && price < z.bottom) continue;
         if(dir < 0 && price > z.top) continue;

         Reject rj;
         if(!Rejection(m15, last, z, dir, rj)) continue;
         if(InpRequireStopHunt && !rj.stopHunt) continue;
         Geo g = Geometry(zz, dir, rj.extreme, rj.firstIdx);
         if(InpRequireGeometry && !g.complete) continue;

         double dist, tp;
         if(InpQuickMode)
           {
            dist = InpQuickSL * g_pt;
            tp = price + dir * InpQuickTP * g_pt;
           }
         else
           {
            double structural = dir > 0 ? MathMin(MathMin(rj.extreme, z.bottom), cLo) - InpSLBuffer * g_pt
                                        : MathMax(MathMax(rj.extreme, z.top), cHi) + InpSLBuffer * g_pt;
            dist = MathMax((price - structural) * dir, reg.minSL);
            if(dist > InpMaxSL * g_pt) continue;

            // Target : zone opposée, borne du range (U) ou mouvement mesuré (N) — la plus proche valide
            tp = 0;
            double best = DBL_MAX;
            for(int k = 0; k <= ArraySize(zones); k++)
              {
               double cand;
               if(k < ArraySize(zones))
                 {
                  if(zones[k].side != -dir) continue;
                  cand = (dir > 0 ? zones[k].bottom : zones[k].top) - dir * InpTargetMargin * g_pt;
                 }
               else if(reg.isRange) cand = (dir > 0 ? reg.high : reg.low) - dir * InpTargetMargin * g_pt;
               else if(g.found)     cand = price + dir * g.cd;
               else continue;
               double gain = (cand - price) * dir;
               if(gain <= 0 || gain / dist < InpMinRR) continue;
               if(gain < best) { best = gain; tp = cand; }
              }
            if(tp == 0) continue;
           }

         // Exécution au marché, stops recalculés sur le prix réel
         double px = dir > 0 ? SymbolInfoDouble(_Symbol, SYMBOL_ASK) : SymbolInfoDouble(_Symbol, SYMBOL_BID);
         double sl = NormalizeDouble(dir > 0 ? MathMin(price - dist, px - reg.minSL) : MathMax(price + dist, px + reg.minSL), _Digits);
         if(InpQuickMode) sl = NormalizeDouble(px - dir * dist, _Digits);
         tp = NormalizeDouble(tp, _Digits);
         double risk = (px - sl) * dir;
         if(risk <= 0 || (tp - px) * dir <= 0 || risk > InpMaxSL * g_pt * 1.2) continue;
         double lots = LotsForRisk(risk);
         if(lots <= 0) { Print("Lot minimum > risque autorisé : trade ignoré"); return; }

         string cmt = "GDR:" + DoubleToString(risk, _Digits);
         bool ok = dir > 0 ? trade.Buy(lots, _Symbol, px, sl, tp, cmt) : trade.Sell(lots, _Symbol, px, sl, tp, cmt);
         if(ok) GlobalVariableSet("GDR_" + IntegerToString((long)trade.ResultOrder()), risk);
         PrintFormat("%s %s %.2f lots @%.1f SL %.1f TP %.1f | %s | zone %.1f-%.1f | %d mèche(s)%s%s | AB=CD x%.2f%s",
                     ok ? "OUVERT" : "ÉCHEC", dir > 0 ? "BUY" : "SELL", lots, px, sl, tp,
                     reg.isRange ? "range (U)" : "impulsion (N)", z.bottom, z.top, rj.count,
                     rj.stopHunt ? " + stop hunt" : "", rj.engulf ? " + avalement" : "",
                     g.ratio, g.complete ? " ✓" : "");
         return;
        }
     }
  }
//+------------------------------------------------------------------+
