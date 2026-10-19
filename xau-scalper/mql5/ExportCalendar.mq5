//+------------------------------------------------------------------+
//| ExportCalendar.mq5 — exporte les annonces USD (impact fort) du    |
//| calendrier économique MT5 vers un CSV lu par xauscalp.            |
//| Le paquet Python MetaTrader5 n'accède pas au calendrier : ce      |
//| script (à lancer chaque jour, ou en service) fait le pont.         |
//| NON COMPILÉ dans cet environnement : à compiler dans MetaEditor.   |
//+------------------------------------------------------------------+
#property script_show_inputs
#property strict

input int    InpDaysBack    = 1;                 // jours passés exportés
input int    InpDaysAhead   = 14;                // jours à venir exportés
input string InpCurrency    = "USD";
input string InpFile        = "xauscalp_calendar.csv"; // dans Terminal\Common\Files

void OnStart()
  {
   MqlCalendarValue values[];
   datetime from = TimeCurrent() - InpDaysBack * 86400;
   datetime to   = TimeCurrent() + InpDaysAhead * 86400;
   if(CalendarValueHistory(values, from, to, NULL, InpCurrency) <= 0)
     { Print("Calendrier vide ou indisponible : ", GetLastError()); return; }
   int h = FileOpen(InpFile, FILE_WRITE | FILE_CSV | FILE_COMMON | FILE_ANSI, ',');
   if(h == INVALID_HANDLE) { Print("Ouverture du fichier impossible : ", GetLastError()); return; }
   FileWrite(h, "time_utc", "currency", "impact", "name");
   // TimeCurrent() est l'heure serveur : écart serveur - UTC pour convertir les heures d'annonce
   long offset = (long)(TimeTradeServer() - TimeGMT());
   int n = 0;
   for(int i = 0; i < ArraySize(values); i++)
     {
      MqlCalendarEvent ev;
      if(!CalendarEventById(values[i].event_id, ev)) continue;
      if(ev.importance != CALENDAR_IMPORTANCE_HIGH) continue;
      datetime utc = (datetime)((long)values[i].time - offset);
      MqlDateTime t; TimeToStruct(utc, t);
      string ts = StringFormat("%04d-%02d-%02d %02d:%02d", t.year, t.mon, t.day, t.hour, t.min);
      string name = ev.name;
      StringReplace(name, ",", " ");
      FileWrite(h, ts, InpCurrency, "high", name);
      n++;
     }
   FileClose(h);
   PrintFormat("%d annonces exportées dans Common\\Files\\%s", n, InpFile);
  }
