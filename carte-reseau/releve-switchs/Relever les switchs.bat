@echo off
rem Releve des switchs pour Carto Reseau : double-cliquez sur ce fichier.
rem Tout le programme est dans ce fichier (partie PowerShell plus bas).
title Releve des switchs - Carto Reseau
chcp 65001 >nul
set "CARTO_ICI=%~dp0"
set "CARTO_BAT=%~f0"
echo Demarrage...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c=[IO.File]::ReadAllText($env:CARTO_BAT,[Text.Encoding]::UTF8); $i=$c.IndexOf('#DEBUT'+'_POWERSHELL'); Invoke-Expression $c.Substring($i) } catch { Write-Host ''; Write-Host 'ERREUR :' $_.Exception.Message -ForegroundColor Red; Write-Host $_.InvocationInfo.PositionMessage -ForegroundColor Yellow; Write-Host ''; Write-Host 'Faites une capture de cette fenetre et envoyez-la.'; Read-Host 'Entree pour fermer' }"
if errorlevel 9009 (echo PowerShell introuvable sur ce PC. & pause)
exit /b

#DEBUT_POWERSHELL
# Relevé automatique des switchs pour Carto Réseau (lancé par « Relever les switchs.bat »)
# Multisite, plusieurs identifiants essayés à la suite, marque reconnue automatiquement.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
# Entrée de plink en UTF-8 SANS BOM : avec « chcp 65001 », .NET envoyait d'abord les octets EF BB BF au switch
# (Cisco : « o;? » puis « % Unrecognized command » ; Planet : login vide « Authentication Failed »).
$SansBom = New-Object Text.UTF8Encoding($false)
try { [Console]::InputEncoding = $SansBom } catch {}

# ---------------- réglages ----------------
# Tout est rangé dans le dossier où se trouve « Relever les switchs.bat » (quel que soit son nom ou son emplacement)
$Racine  = if ($env:CARTO_ICI) { $env:CARTO_ICI.TrimEnd('\') } else { 'C:\Users\Administrateur\Desktop\Carto Réseau' }
$Sites   = Join-Path $Racine 'Sites'          # un dossier par site
$VersionCommandes = 6
$VersionScript = '5.2'   # écrit dans l'en-tête de chaque relevé
$Ici     = $env:CARTO_ICI
$Delai   = 240          # secondes maximum par switch
$AttenteBlocage = 125   # secondes d'attente quand un switch bloque après des échecs de login
$Session = 'Carto-Releve'
$script:nPlink = 0
$script:tmpDir = $env:TEMP

# Marques : reconnaissance (sur la bannière et show/display version), commandes de sortie,
# et « enable » à taper si le switch arrive en mode utilisateur (prompt « > »).
$Profils = [ordered]@{
    arubacx  = @{ Nom = 'Aruba CX';                 Detect = 'ArubaOS-CX|AOS-CX|Aruba(?:OS)?[ -]?CX\b';                                           Enable = $false; Sortie = @('exit', 'exit', 'exit') }
    hp       = @{ Nom = 'HP / ArubaOS-Switch';      Detect = 'ProCurve|ArubaOS-Switch|Image stamp|\bHP J\d{4}|Hewlett[- ]Packard|\bJ[L]?\d{3,4}A\b|Aruba (?:2530|2540|2920|2930|3810|5400)'; Enable = $false; Sortie = @('logout', 'exit', 'exit') }
    cisco    = @{ Nom = 'Cisco';                    Detect = 'Cisco IOS|IOS[- ]XE|Cisco Internetwork|Cisco Systems|NX-OS|Catalyst|Cisco Business';  Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    planet   = @{ Nom = 'Planet';                   Detect = 'PLANET|Layer 2 Managed Switch|Loader Version|10456';                                  Enable = $false; Sortie = @('exit', 'exit', 'exit') }
    netgear  = @{ Nom = 'Netgear';                  Detect = 'NETGEAR|ProSAFE';                                                                     Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    comnet   = @{ Nom = 'ComNet';                   Detect = 'ComNet|\bCN(?:GE|GS|FE)\d|<ctrl\+q>: Logout|<ctrl\+z>: Up level|1\.3\.6\.1\.4\.1\.32298\b';     Enable = $true;  Sortie = @('logout', 'quit', 'exit') }
    huawei   = @{ Nom = 'Huawei / H3C';             Detect = 'Huawei|VRP \(R\)|Versatile Routing Platform|Comware|\bH3C\b';                         Enable = $false; Sortie = @('quit', 'quit') }
    juniper  = @{ Nom = 'Juniper';                  Detect = 'JUNOS|Junos|Juniper';                                                                 Enable = $false; Sortie = @('exit', 'exit') }
    ruckus   = @{ Nom = 'Ruckus / Brocade ICX';      Detect = 'Ruckus|\bICX ?\d{4}|FastIron|Brocade';                                                Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    dell     = @{ Nom = 'Dell';                     Detect = 'Dell EMC|Dell Networking|PowerConnect|\bOS10\b|Dell Inc';                             Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    allied   = @{ Nom = 'Allied Telesis';           Detect = 'Allied Telesis|AlliedWare';                                                           Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    extreme  = @{ Nom = 'Extreme Networks';         Detect = 'ExtremeXOS|Extreme Networks|\bEXOS\b';                                                Enable = $false; Sortie = @('exit', 'exit') }
    dlink    = @{ Nom = 'D-Link';                   Detect = 'D-Link|\bD[GEX]S-\d';                                                                 Enable = $false; Sortie = @('logout', 'exit') }
    zyxel    = @{ Nom = 'Zyxel';                    Detect = 'ZyXEL|Zyxel';                                                                         Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    tplink   = @{ Nom = 'TP-Link';                  Detect = 'TP-?Link|JetStream';                                                                  Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
    defaut   = @{ Nom = 'marque non reconnue';      Detect = '';                                                                                    Enable = $true;  Sortie = @('exit', 'exit', 'exit') }
}
$ProfilMikrotik = @{ Nom = 'MikroTik' }

$CommandesParDefaut = @'
# version-commandes: 6
# Commandes envoyées aux switchs, rangées par marque. Le script reconnaît la marque tout seul
# (show version / display version, bannière de connexion) puis envoie la section qui correspond.
# - Une commande par ligne. Les lignes qui commencent par # sont ignorées.
# - « sauvegarde: » = commande de sauvegarde de la configuration (rangée à part, dans Config Switch).
# - Une commande refusée par un switch (« Invalid input », « Unknown command ») n'est pas grave : les autres passent.
# - « cmd1 || cmd2 || cmd3 » : cmd2 n'est envoyée que si cmd1 est refusée, etc. (variantes selon la gamme ou le nombre de ports).
# - [defaut] sert quand la marque n'est pas reconnue.
# - Vous pouvez modifier ce fichier : vos changements sont conservés tant que la ligne « version-commandes » ne change pas.

[cisco]
# Cisco IOS / IOS-XE (Catalyst) et Cisco Business / SG (terminal datadump)
terminal length 0
terminal datadump
show version
show inventory
show ip interface brief
show interfaces status
show interfaces description
show vlan brief
show interfaces trunk
show etherchannel summary
show cdp neighbors detail
show lldp neighbors detail
show mac address-table
show ip arp
show spanning-tree summary
show spanning-tree root
show power inline
show interfaces counters errors
show logging | include MACFLAP|HOST_FLAP|MAC_MOVE
sauvegarde: show running-config

[arubacx]
# Aruba CX (6000, 6100, 6300, 8xxx)
no page
show version
show system
show ip interface brief
show interface brief
show vlan
show lacp aggregates
show lacp interfaces
show lldp neighbor-info detail
show mac-address-table
show arp
show spanning-tree
show power-over-ethernet brief
show power-over-ethernet
sauvegarde: show running-config

[hp]
# HP / Aruba ArubaOS-Switch (2530, 2540, 2930, 3810, 5400, ProCurve)
no page
show system
show version
show ip
show interfaces brief
show name
show vlans
show trunks
show lacp
show lldp info remote-device detail
show cdp neighbors detail
show mac-address
show arp
show spanning-tree
show power-over-ethernet brief
sauvegarde: show running-config

[planet]
# Planet, 3 familles :
#  - ICLI (GS-5220 / IGS-5225… v5, ports « GigabitEthernet 1/1 ») : « show interface * status » ;
#  - GE1 / XG1 (GS-5220-16S8CR v2) et gi1 (IGS-4215, GS-4210…) : la plage doit coller au nombre de ports
#    (« Invalid port id » sinon) : on essaie de la plus grande à la plus petite.
terminal length 0
show version
show info
show interface * status || show interface GigabitEthernet 1-52 status || show interface GigabitEthernet 1-28 status || show interface GigabitEthernet 1-26 status || show interface GigabitEthernet 1-24 status || show interface GigabitEthernet 1-20 status || show interface GigabitEthernet 1-18 status || show interface GigabitEthernet 1-16 status || show interface GigabitEthernet 1-12 status || show interface GigabitEthernet 1-10 status || show interface GigabitEthernet 1-8 status || show interface GigabitEthernet 1-6 status || show interface GigabitEthernet 1-5 status
show interface * switchport || show interface switchport Giga 1-52 || show interface switchport Giga 1-28 || show interface switchport Giga 1-26 || show interface switchport Giga 1-24 || show interface switchport Giga 1-20 || show interface switchport Giga 1-18 || show interface switchport Giga 1-16 || show interface switchport Giga 1-12 || show interface switchport Giga 1-10 || show interface switchport Giga 1-8 || show interface switchport Giga 1-6 || show interface switchport Giga 1-5
show vlan
show lldp neighbors || show lldp neighbor
show mac address-table
show ip arp || show arp
show poe || show poe interface || show power inline
sauvegarde: show running-config

[netgear]
# Netgear (M4xxx, GSM avec CLI, et gammes Smart à CLI simplifiée)
terminal length 0
show sysinfo
show version
show port all
show interfaces status all
show vlan brief
show port-channel brief
show lldp remote-device all
show lldp neighbor
show mac-addr-table
show mac address-table
show arp
show spanning-tree
show poe
sauvegarde: show running-config

[comnet]
# ComNet CNGE… / CNFE… (invite « switch> », passage en « switch# » par enable ; sortie par logout)
# Relevé réel (CNGE2FE8MSPOE+ v1.37) : show system accepté. Les autres sont celles du manuel ComNet.
terminal length 0
show system || show system-info
show version
show ip
show interface status || show port status || show interface
show vlan
show lldp neighbor || show lldp neighbors || show lldp
show mac-address-table || show mac address-table
show spanning-tree
show arp || show ip arp
show poe || show poe status
sauvegarde: show running-config || show config

[mikrotik]
# MikroTik RouterOS (CRS) : une connexion par commande
/system identity print
/system routerboard print
/system resource print
/ip address print without-paging
/interface ethernet print without-paging
/ip neighbor print detail without-paging
/interface bridge host print without-paging
/ip arp print without-paging
sauvegarde: /export

[huawei]
# Huawei (VRP) et H3C / HPE Comware : commandes « display ». Celles de l'autre gamme sont refusées.
screen-length 0 temporary
screen-length disable
display version
display device
display interface brief
display vlan
display lldp neighbor brief
display lldp neighbor
display lldp neighbor-information verbose
display mac-address
display arp
display eth-trunk
display link-aggregation summary
display stp brief
sauvegarde: display current-configuration

[juniper]
# Juniper EX (Junos)
set cli screen-length 0
set cli screen-width 0
show version
show chassis hardware
show interfaces terse
show interfaces descriptions
show vlans
show lldp neighbors
show ethernet-switching table
show arp no-resolve
show lacp interfaces
show spanning-tree bridge
show poe interface
sauvegarde: show configuration | display set

[ruckus]
# Ruckus / Brocade ICX (FastIron)
skip-page-display
show version
show interfaces brief
show vlan brief
show lldp neighbors detail
show mac-address
show arp
show lag brief
show inline power
sauvegarde: show running-config

[dell]
# Dell EMC / PowerConnect (OS6, N-series) et OS10
terminal length 0
show version
show system
show interfaces status
show vlan
show lldp remote-device all
show lldp neighbors detail
show mac address-table
show arp
show port-channel brief
show spanning-tree
sauvegarde: show running-config

[allied]
# Allied Telesis (AlliedWare Plus)
terminal length 0
show system
show version
show interface brief
show vlan brief
show lldp neighbors detail
show mac address-table
show arp
show etherchannel
show spanning-tree
show power-inline
sauvegarde: show running-config

[extreme]
# Extreme Networks (EXOS)
disable clipaging
show version
show switch
show ports no-refresh
show vlan
show lldp neighbors detailed
show fdb
show iparp
show sharing
sauvegarde: show configuration

[dlink]
# D-Link (DGS / DES, CLI « show switch ») : à vérifier selon la gamme
disable clipaging
show switch
show ports
show vlan
show lldp remote_ports
show fdb
show arpentry
sauvegarde: show config current_config

[zyxel]
# Zyxel (GS, XGS) : à vérifier selon la gamme
show system-information
show version
show interfaces status
show vlan
show lldp info remote
show mac address-table all
show ip arp
sauvegarde: show running-config

[tplink]
# TP-Link JetStream / Omada : à vérifier selon la gamme
terminal length 0
show system-info
show interface status
show vlan
show lldp neighbor-information
show mac address-table all
show arp
sauvegarde: show running-config

[defaut]
# Marque non reconnue : commandes les plus courantes (beaucoup seront refusées, ce n'est pas grave)
terminal length 0
terminal datadump
no page
show version
show system
show interfaces status
show interface brief
show vlan
show lldp neighbors detail
show lldp neighbor
show cdp neighbors detail
show mac address-table
show mac-address
show arp
show ip arp
sauvegarde: show running-config
'@

function Titre($t) { Write-Host ''; Write-Host $t -ForegroundColor Cyan }
function Stop-Script($msg) {
    Write-Host ''; Write-Host $msg -ForegroundColor Red
    Read-Host 'Entrée pour fermer' | Out-Null
    exit 1
}

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host '   Relevé des switchs  -  Carto Réseau' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $Sites | Out-Null
$Journal = Join-Path $Racine '_journal.txt'     # remplacé par le journal du site une fois le site choisi
function Journal($t) { try { Add-Content -Path $Journal -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $t) -Encoding UTF8 } catch {} }

# ---------------- plink.exe ----------------
$plink = @(
    $(if ($Ici) { Join-Path $Ici 'plink.exe' }),
    (Join-Path $Racine 'plink.exe'),
    'C:\Users\Administrateur\Desktop\Carto Réseau\plink.exe',
    "$env:ProgramFiles\PuTTY\plink.exe",
    "${env:ProgramFiles(x86)}\PuTTY\plink.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $plink) {
    $c = Get-Command plink.exe -ErrorAction SilentlyContinue
    if ($c) { $plink = $c.Source }
}
if (-not $plink) {
    Stop-Script ("plink.exe introuvable.`r`nCopiez plink.exe (outil de PuTTY, téléchargeable sur putty.org) dans :`r`n  $Racine`r`n(le même dossier que Relever les switchs.bat) puis relancez.")
}

# ---------------- commandes par marque ----------------
$fCmd = Join-Path $Racine 'commandes.txt'
# Un commandes.txt d'une ancienne version est mis de côté (« commandes (ancien).txt ») et remplacé
# par la liste à jour. Une fois à jour, vos modifications de ce fichier sont conservées.
if ((Test-Path $fCmd) -and -not (Select-String -Path $fCmd -Pattern "version-commandes: $VersionCommandes\b" -Quiet)) {
    Move-Item -Path $fCmd -Destination (Join-Path $Racine 'commandes (ancien).txt') -Force
    Write-Host 'commandes.txt mis à jour : commandes rangées par marque (l''ancien est gardé dans « commandes (ancien).txt »).' -ForegroundColor Yellow
}
if (-not (Test-Path $fCmd)) {
    [IO.File]::WriteAllText($fCmd, ($CommandesParDefaut -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding($true)))
}
function Lire-Commandes($fichier) {
    $res = @{}; $cur = $null
    foreach ($l in (Get-Content -Path $fichier -Encoding UTF8)) {
        $t = $l.Trim()
        if (-not $t -or $t.StartsWith('#')) { continue }
        if ($t -match '^\[([\w-]+)\]$') { $cur = $Matches[1].ToLower(); $res[$cur] = @{ Cmds = New-Object Collections.ArrayList; Sauvegarde = '' }; continue }
        if (-not $cur) { continue }
        if ($t -match '^sauvegarde\s*:\s*(.*)$') { $res[$cur].Sauvegarde = $Matches[1].Trim(); continue }
        [void]$res[$cur].Cmds.Add($t)
    }
    return $res
}
$CmdMarques = Lire-Commandes $fCmd
if (-not $CmdMarques['defaut']) { Stop-Script "Le fichier $fCmd ne contient pas de section [defaut]." }
Remove-Item (Join-Path $Racine 'commandes-mikrotik.txt') -ErrorAction SilentlyContinue   # remplacé par la section [mikrotik]

# ---------------- session PuTTY dédiée ----------------
# Accepte les vieux switchs (diffie-hellman-group1-sha1) sans alerte et élargit le terminal
# pour que les tableaux ne soient pas coupés. Ne modifie pas vos sessions PuTTY habituelles.
$cle = "HKCU:\Software\SimonTatham\PuTTY\Sessions\$Session"
New-Item -Path $cle -Force | Out-Null
Set-ItemProperty -Path $cle -Name 'KEX' -Value 'ecdh,dh-gex-sha1,dh-group14-sha1,rsa,dh-group1-sha1,WARN'
Set-ItemProperty -Path $cle -Name 'Cipher' -Value 'aes,chacha20,aes-gcm,3des,des,blowfish,WARN,arcfour'
Set-ItemProperty -Path $cle -Name 'TermWidth' -Value 250 -Type DWord
Set-ItemProperty -Path $cle -Name 'TermHeight' -Value 2000 -Type DWord
Set-ItemProperty -Path $cle -Name 'Protocol' -Value 'ssh'
Set-ItemProperty -Path $cle -Name 'PortNumber' -Value 22 -Type DWord

# ---------------- site ----------------
function Nom-Fichier($t) { return (($t -replace '[\\/:*?"<>|]', '_').Trim().TrimEnd('.')) }
$fDernier = Join-Path $Racine 'dernier-site.txt'
function Choisir-Site {
    $liste = @(Get-ChildItem -Path $Sites -Directory -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object Name)
    $dernier = if (Test-Path $fDernier) { (Get-Content $fDernier -Encoding UTF8 -TotalCount 1) } else { '' }
    if ($dernier -and $liste -notcontains $dernier) { $dernier = '' }
    while ($true) {
        Titre 'Site'
        if ($liste.Count) {
            for ($k = 0; $k -lt $liste.Count; $k++) { Write-Host ("  {0,2}. {1}" -f ($k + 1), $liste[$k]) }
            Write-Host "Tapez le numéro d'un site, ou le nom d'un nouveau site."
            if ($dernier) { Write-Host "Entrée seule : $dernier" }
        } else { Write-Host 'Aucun site pour l''instant. Tapez le nom du site (ex. STGR Sarcelles).' }
        $s = (Read-Host 'Site').Trim()
        if (-not $s -and $dernier) { return $dernier }
        if ($s -match '^\d+$' -and [int]$s -ge 1 -and [int]$s -le $liste.Count) { return $liste[[int]$s - 1] }
        $s = Nom-Fichier $s
        if ($s) {
            if ($liste -notcontains $s) {
                $ok = Read-Host "Créer le site « $s » ? (O/N)"
                if ($ok -notmatch '^[oO]') { continue }
            }
            return $s
        }
    }
}
$NomSite = Choisir-Site
Set-Content -Path $fDernier -Value $NomSite -Encoding UTF8
$Dossier = Join-Path $Sites $NomSite
$Logs    = Join-Path $Dossier 'Log Switch'
$Configs = Join-Path $Dossier 'Config Switch'   # sauvegardes des configurations
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
New-Item -ItemType Directory -Force -Path $Configs | Out-Null
$Journal = Join-Path $Logs '_journal.txt'
$fListe  = Join-Path $Dossier 'switchs.txt'
if (-not (Test-Path $fListe)) {
    Set-Content -Path $fListe -Encoding UTF8 -Value @("# Switchs du site $NomSite : une IP par ligne (texte libre possible après l'IP).", '')
}
Journal "--- démarrage, site : $NomSite ---"
Write-Host "Site : $NomSite" -ForegroundColor Green
Write-Host "  dossier : $Dossier" -ForegroundColor DarkGray

# ---------------- identifiants ----------------
# Liste d'identifiants essayés à la suite. Chiffrés (DPAPI) : seul votre compte Windows sur ce PC peut les relire.
$fId = Join-Path $Racine 'identifiants.xml'
$Ids = New-Object Collections.ArrayList
function Sauver-Ids { @($Ids) | Export-Clixml -Path $fId }
function Nouvel-Id {
    Titre 'Nouvel identifiant'
    $u = Read-Host 'Login'
    if (-not $u.Trim()) { return $null }
    $p = Read-Host 'Mot de passe' -AsSecureString
    $e = Read-Host 'Mot de passe « enable » (Entrée si aucun)' -AsSecureString
    return [pscustomobject]@{ Id = [guid]::NewGuid().ToString('N').Substring(0, 8); Cred = (New-Object System.Management.Automation.PSCredential($u.Trim(), $p)); Enable = $(if ($e.Length) { $e } else { $null }) }
}
if (Test-Path $fId) {
    try {
        foreach ($o in @(Import-Clixml -Path $fId)) {
            if ($o -is [System.Management.Automation.PSCredential]) {        # ancien format : un seul identifiant
                [void]$Ids.Add([pscustomobject]@{ Id = [guid]::NewGuid().ToString('N').Substring(0, 8); Cred = $o; Enable = $null })
            } elseif ($o.Cred) {
                $c = $o.Cred
                if ($c -isnot [System.Management.Automation.PSCredential]) { $c = New-Object System.Management.Automation.PSCredential($c.UserName, $c.Password) }
                [void]$Ids.Add([pscustomobject]@{ Id = $o.Id; Cred = $c; Enable = $o.Enable })
            }
        }
    } catch { Write-Host 'Fichier d''identifiants illisible (créé sur un autre PC ou un autre compte Windows) : à ressaisir.' -ForegroundColor Yellow }
}
function Afficher-Ids {
    Titre 'Identifiants (essayés dans cet ordre si le switch refuse)'
    if (-not $Ids.Count) { Write-Host '  aucun' }
    for ($k = 0; $k -lt $Ids.Count; $k++) {
        Write-Host ("  {0}. {1}{2}" -f ($k + 1), $Ids[$k].Cred.UserName, $(if ($Ids[$k].Enable) { '  (+ enable)' } else { '' }))
    }
}
while ($true) {
    if (-not $Ids.Count) {
        Write-Host ''; Write-Host 'Aucun identifiant enregistré.' -ForegroundColor Yellow
        $n = Nouvel-Id; if ($n) { [void]$Ids.Add($n); Sauver-Ids }
        continue
    }
    Afficher-Ids
    $r = (Read-Host 'Entrée : continuer   A : ajouter   S : supprimer   M : monter un identifiant en premier').Trim()
    if (-not $r) { break }
    if ($r -match '^[aA]') { $n = Nouvel-Id; if ($n) { [void]$Ids.Add($n); Sauver-Ids; Write-Host 'Ajouté et enregistré, chiffré.' -ForegroundColor DarkGray } }
    elseif ($r -match '^[sS]') {
        $k = Read-Host 'Numéro à supprimer'
        if ($k -match '^\d+$' -and [int]$k -ge 1 -and [int]$k -le $Ids.Count) { $Ids.RemoveAt([int]$k - 1); Sauver-Ids }
    } elseif ($r -match '^[mM]') {
        $k = Read-Host 'Numéro à mettre en premier'
        if ($k -match '^\d+$' -and [int]$k -ge 1 -and [int]$k -le $Ids.Count) { $x = $Ids[[int]$k - 1]; $Ids.RemoveAt([int]$k - 1); $Ids.Insert(0, $x); Sauver-Ids }
    }
}

# Mémoire par site : quel identifiant a marché sur quel switch (sans mot de passe)
$fMem = Join-Path $Dossier 'identifiant-par-switch.csv'
$Memoire = @{}
if (Test-Path $fMem) { try { Import-Csv -Path $fMem -Delimiter ';' -Encoding UTF8 | ForEach-Object { $Memoire[$_.IP] = $_.Id } } catch {} }
function Retenir($ip, $id) {
    $Memoire[$ip] = $id
    try { $Memoire.GetEnumerator() | Sort-Object Name | ForEach-Object { $v = $_.Value; [pscustomobject]@{ IP = $_.Name; Id = $v; Login = (@($Ids | Where-Object { $_.Id -eq $v }) | Select-Object -First 1).Cred.UserName } } |
          Export-Csv -Path $fMem -Delimiter ';' -NoTypeInformation -Encoding UTF8 } catch {}
}
function Ordre-Ids($ip) {
    $id = $Memoire[$ip]
    $a = @($Ids | Where-Object { $_.Id -eq $id }); $b = @($Ids | Where-Object { $_.Id -ne $id })
    return @($a + $b | ForEach-Object {
        [pscustomobject]@{ Id = $_.Id; User = $_.Cred.UserName; Pass = $_.Cred.GetNetworkCredential().Password
                           Enable = $(if ($_.Enable) { (New-Object System.Management.Automation.PSCredential('x', $_.Enable)).GetNetworkCredential().Password } else { '' }) } })
}

# ---------------- relevé d'un switch ----------------
function Q($s) { '"' + ($s -replace '"', '\"') + '"' }

# Lecture qui tolère un fichier encore ouvert par plink
function LireOctets($f) {
    for ($k = 0; $k -lt 10; $k++) {
        try {
            if (-not (Test-Path $f)) { return [byte[]]@() }
            $fs = New-Object IO.FileStream($f, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
            try { $ms = New-Object IO.MemoryStream; $fs.CopyTo($ms); return ,$ms.ToArray() } finally { $fs.Dispose() }
        } catch { Start-Sleep -Milliseconds 300 }
    }
    return [byte[]]@()
}
function Lire($f) { $b = LireOctets $f; if ($b.Length) { [Text.Encoding]::UTF8.GetString($b) } else { '' } }

# Lance plink avec des fichiers temporaires neufs à chaque fois.
# $arretSi : condition (sur le texte d'erreur) qui permet d'arrêter plink dès qu'on a ce qu'il faut.
function Lancer-Plink($argsTxt, $entree, $delai, $arretSi) {
    $script:nPlink++
    $o = Join-Path $script:tmpDir ('o' + $script:nPlink + '.txt')
    $e = Join-Path $script:tmpDir ('e' + $script:nPlink + '.txt')
    Journal ('plink ' + ($argsTxt -replace '-pw "(?:[^"\\]|\\.)*"', '-pw ****'))
    $p = Start-Process -FilePath $plink -ArgumentList $argsTxt -RedirectStandardInput $entree `
         -RedirectStandardOutput $o -RedirectStandardError $e -NoNewWindow -PassThru
    $chrono = [Diagnostics.Stopwatch]::StartNew()
    while (-not $p.WaitForExit(250)) {
        if ($arretSi -and ((Lire $e) -match $arretSi)) { break }
        if ($chrono.Elapsed.TotalSeconds -ge $delai) { Journal "  coupé après $delai s"; break }
    }
    $fini = $p.HasExited
    if (-not $fini) { try { $p.Kill() } catch {}; try { $p.WaitForExit(5000) | Out-Null } catch {} }
    $err = Lire $e
    $octets = LireOctets $o
    $resume = ($err -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch '^(Looking up|Connecting to|Connected to|We claim|Using |Doing |Host key|Initialised|Server supports|Attempting|Sent |Opened|Started|Allocated|Requesting|Using SSPI|Pre-authentication|Reading|Hash of|Event Log)' } | Select-Object -Last 3) -join ' / '
    Journal ("  fin : " + $octets.Length + " octets reçus" + $(if ($resume) { ' | ' + $resume } else { '' }))
    return [pscustomobject]@{ Fini = $fini; Err = $err; Octets = $octets }
}

# Codes d'écran envoyés par certains switchs (ComNet : effacement, couleurs, jeu de caractères, curseur).
# Répété jusqu'à disparition : un code peut en couper un autre (« ESC[2 ESC(B J »).
function Sans-Codes($t) {
    $e = [string][char]27
    $simple = $e + '(?:[()*+][0-9A-Za-z]|[ -/]*[0-Z\\^-~])'                                # jeu de caractères, curseur (ESC 7 / ESC 8)…
    $csi = $e + '(?:\[[0-?]*[ -/]*[@-~]|\][^\x07' + $e + ']*(?:\x07|' + $e + '\\)?)'      # couleurs, effacement, titre
    for ($n = 0; $n -lt 5; $n++) { $u = ($t -replace $simple, '') -replace $csi, ''; if ($u -eq $t) { break }; $t = $u }
    return ($t -replace '[\x00\x07]', '')
}

# Reconnaît la marque d'après la bannière, le prompt et show/display version
function Detecter-Marque($texte, $invite) {
    $texte = Sans-Codes $texte     # codes d'écran (ComNet : effacement, couleurs)
    foreach ($k in $Profils.Keys) {
        $d = $Profils[$k].Detect
        if ($d -and $texte -match ('(?i)' + $d)) { return $k }
    }
    if ($invite -match '^<.+') { return 'huawei' }          # prompt <NOM> : Huawei / H3C
    return 'defaut'
}

# Session interactive : le script lit ce que le switch affiche et répond au bon moment.
#  1. connexion : bannières « Press any key / Press <Enter> », login redemandé dans la session (Planet, Netgear…)
#     avec les identifiants de la liste, l'un après l'autre ;
#  2. sonde : show version (ou display version si le prompt est <NOM>) pour reconnaître la marque ;
#  3. commandes de la marque, puis sauvegarde de la configuration ; « enable » si le prompt finit par « > » ;
#  4. sortie propre (exit / quit / logout, en répondant aux questions « sauvegarder ? » / « se déconnecter ? »).
# $ids : identifiants dans l'ordre d'essai ; $debut : premier identifiant à utiliser (celui passé à plink).
function Dialoguer($argsTxt, $ids, $debut, $delai) {
    $script:nPlink++
    Journal ('plink ' + ($argsTxt -replace '-pw "(?:[^"\\]|\\.)*"', '-pw ****') + '  (dialogue)')
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = $plink; $psi.Arguments = $argsTxt
    $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    if ($psi.PSObject.Properties['StandardInputEncoding']) { $psi.StandardInputEncoding = $SansBom }
    try { [Console]::InputEncoding = $SansBom } catch {}
    $p = [Diagnostics.Process]::Start($psi)
    $tErr = $p.StandardError.ReadToEndAsync()
    $flux = $p.StandardOutput.BaseStream
    $entree = $p.StandardInput.BaseStream
    $ms = New-Object IO.MemoryStream
    $tampon = New-Object byte[] 65536
    $lecture = $flux.ReadAsync($tampon, 0, $tampon.Length)
    $chrono = [Diagnostics.Stopwatch]::StartNew()
    $calme = [Diagnostics.Stopwatch]::StartNew()      # temps depuis la dernière donnée reçue
    $st = @{ depuis = 0; alts = @(); ligne = ''; refus = 0 }   # depuis : position du texte après notre dernier envoi
    $phase = 'connexion'; $cmds = @(); $i = 0; $sorties = 0; $probleme = ''; $fin = $false
    $courant = $debut; $essais = 0; $mdpDu = $false; $attendEnable = $false; $enableFait = $false
    $marque = ''; $sonde = ''; $sondesEnPlus = @('display version', 'show system'); $sondesFaites = @(); $sortie = @('exit', 'exit', 'exit'); $sauvegarde = ''
    $marques = New-Object Collections.ArrayList     # position du début de chaque commande dans la sortie
    $invite = ''                                    # nom du prompt, appris au premier prompt
    $envoyer = {
        param($txt)
        $b = [Text.Encoding]::UTF8.GetBytes($txt + "`r")
        try { $entree.Write($b, 0, $b.Length); $entree.Flush() } catch {}
        $st.depuis = $ms.Length
        $calme.Restart()
    }
    $commande = {
        param($c, $ligne)
        if (-not $ligne) { $ligne = $c }
        [void]$marques.Add([pscustomobject]@{ Cmd = $c; Ligne = $ligne; Debut = $ms.Length })
        & $envoyer $c
    }
    # ligne de commandes.txt : « cmd1 || cmd2 || cmd3 » = essayer cmd1, puis cmd2 si refusée, etc.
    $lancer = {
        param($ligne)
        $parts = @($ligne -split '\s*\|\|\s*' | Where-Object { $_ })
        $st.alts = @($parts | Select-Object -Skip 1); $st.ligne = $ligne
        & $commande $parts[0] $ligne
    }
    while ($true) {
        if ($lecture.Wait(150)) {
            $n = $lecture.Result
            if ($n -le 0) { $fin = $true; break }
            $ms.Write($tampon, 0, $n); $calme.Restart()
            $lecture = $flux.ReadAsync($tampon, 0, $tampon.Length)
            continue
        }
        if ($chrono.Elapsed.TotalSeconds -ge $delai) { Journal "  coupé après $delai s"; break }
        $o = $ms.ToArray()
        $queue = if ($o.Length -gt $st.depuis) { [Text.Encoding]::UTF8.GetString($o, $st.depuis, $o.Length - $st.depuis) } else { '' }
        $q = (Sans-Codes $queue).TrimEnd()
        $ms_calme = $calme.Elapsed.TotalMilliseconds

        if ($q -match '(?i)maximum (cli|ssh|telnet)? ?session|too many (sessions|users|connections)|session limit') { $probleme = 'sessions'; break }
        if ($sorties -gt 0 -and $q -match '(?i)press any|press <?enter|user ?name\s*:|login\s*:') { $fin = $true; break }   # déconnecté après la sortie
        if ($q -match '(?i)too many login failures|please wait for \d+ seconds|locked out|account (is )?locked') { $probleme = 'bloque'; break }
        # questions oui / non : ne jamais sauvegarder, accepter la déconnexion
        if ($q -match '(?i)(save|sauvegard|enregistr)[^\n]*[\[(]\s*y(es)?\s*/\s*n') { if ($ms_calme -ge 300) { & $envoyer 'n' }; continue }
        if ($q -match '(?i)(log ?out|quit|exit|disconnect|déconnect)[^\n]*[\[(]\s*y(es)?\s*/\s*n') { if ($ms_calme -ge 300) { & $envoyer 'y' }; continue }
        if ($q -match '(?i)-+\s*\(?more[^\n]*?\)?\s*-+|press any key|press <?enter>? to continue|press <?space>? to continue') {
            if ($ms_calme -ge 300) { & $envoyer $(if ($q -match '(?i)more|space') { ' ' } else { '' }) }
            continue
        }
        if ($phase -eq 'connexion' -and $q -match '(?i)(user ?name|login|user)\s*:\s*$') {
            if ($ms_calme -ge 300) {
                if ($essais -gt 0) { $courant++ }                  # le login précédent a été refusé
                if ($courant -ge $ids.Count) { $probleme = 'login'; break }
                $essais++; $mdpDu = $true
                Journal ("  login demandé par le switch : essai avec « " + $ids[$courant].User + " »")
                & $envoyer $ids[$courant].User
            }
            continue
        }
        if (($phase -eq 'connexion' -or $attendEnable) -and $q -match '(?i)pass(word|wd)?\s*:\s*$') {
            if ($ms_calme -ge 300) {
                if ($attendEnable) { $attendEnable = $false; & $envoyer $(if ($ids[$courant].Enable) { $ids[$courant].Enable } else { $ids[$courant].Pass }) }
                elseif ($mdpDu) { $mdpDu = $false; & $envoyer $ids[$courant].Pass }
                else { $probleme = 'login'; break }               # mot de passe redemandé : refusé
            }
            continue
        }
        if ($phase -eq 'connexion' -and $q -match '(?i)authentication failed|login (invalid|incorrect|failed)|access denied|bad password') {
            if ($ms_calme -ge 1500) { $probleme = 'login'; break }   # (un nouveau « Username: » permet d'essayer le suivant)
            continue
        }
        # prompt : dernière ligne « nom# », « nom> », « <nom> », « user@nom> ». Une fois le nom connu, on exige le même
        # nom (évite de prendre une ligne de configuration qui finit par # pour un prompt).
        $derniere = ($q -split "[`r`n]")[-1].Trim()
        $derniere = ($derniere -split '(?<=[#>])\s+(?=\S)')[-1]       # HP : « PON# PON# » sur une seule ligne
        $estInvite = $false
        if ($derniere -match '^(.{1,60}?)\s*(\((?:config|vlan)[^)]*\))?\s*[#>\]]$') {
            $nomInv = ($Matches[1] -replace '^\*\s*', '' -replace '\.\d+$', '').Trim()      # Extreme : « * X440.3 # »
            if ($nomInv -match '[A-Za-z0-9]') {
                if (-not $invite -or $phase -eq 'connexion') { $invite = $nomInv }        # appris au premier prompt
                $estInvite = ($nomInv -eq $invite)
            }
        }
        # invite collée à la fin de l'écho (HP : « no pagePON-HDV-SWA-01# »)
        if (-not $estInvite -and $invite -and $phase -ne 'connexion' -and $derniere -match ([regex]::Escape($invite) + '\s*(\((?:config|vlan)[^)]*\))?\s*[#>\]]$')) { $estInvite = $true }
        if (($estInvite -and $ms_calme -ge 400) -or ($ms_calme -ge 8000 -and $chrono.Elapsed.TotalSeconds -ge 8 -and $ms.Length -gt 0)) {
            if ($phase -eq 'connexion') {
                $phase = 'sonde'
                $sonde = if ($invite -match '^<') { 'display version' } else { 'show version' }
                $sondesFaites += $sonde; $sondesEnPlus = @($sondesEnPlus | Where-Object { $_ -ne $sonde }); & $commande $sonde
            } elseif ($phase -eq 'sonde') {
                $txt = [Text.Encoding]::UTF8.GetString($ms.ToArray())
                $marque = Detecter-Marque $txt $invite
                if ($marque -eq 'defaut' -and $sondesEnPlus.Count) {
                    $sonde = $sondesEnPlus[0]; $sondesEnPlus = @($sondesEnPlus | Select-Object -Skip 1); $sondesFaites += $sonde; & $commande $sonde; continue
                }
                $pr = $Profils[$marque]; $sortie = $pr.Sortie
                $sec = if ($CmdMarques[$marque]) { $CmdMarques[$marque] } else { $CmdMarques['defaut'] }
                $sauvegarde = $sec.Sauvegarde
                $cmds = @($sec.Cmds | Where-Object { $sondesFaites -notcontains $_ })
                if ($sauvegarde) { $cmds += $sauvegarde }
                if ($pr.Enable -and $derniere -match '>$' -and $invite -notmatch '^<|@') { $cmds = @('enable') + $cmds }
                Journal ("  marque : " + $pr.Nom + " (" + $cmds.Count + " commandes)")
                $phase = 'commandes'; $i = 0
                if ($cmds[0] -eq 'enable') { $attendEnable = $true; $enableFait = $true; & $envoyer 'enable'; $i = 1; $invite = '' }
                else { & $lancer $cmds[$i]; $i++ }
            } elseif ($phase -eq 'commandes') {
                $refusee = $st.ligne -and $q -match $Refus
                if ($refusee -and $st.alts.Count) { $c = $st.alts[0]; $st.alts = @($st.alts | Select-Object -Skip 1); & $commande $c $st.ligne; continue }
                if ($refusee) { $st.refus++ }
                $st.alts = @(); $st.ligne = ''
                if ($i -lt $cmds.Count) { & $lancer $cmds[$i]; $i++ }
                else { $phase = 'sortie'; [void]$marques.Add([pscustomobject]@{ Cmd = '(sortie)'; Debut = $ms.Length }); & $envoyer $sortie[0]; $sorties = 1 }
            } else {
                if ($sorties -lt $sortie.Count) { & $envoyer $sortie[$sorties]; $sorties++ }
                elseif ($ms_calme -ge 3000) { break }
            }
        }
    }
    if (-not $p.HasExited) { try { $p.Kill() } catch {}; try { $p.WaitForExit(5000) | Out-Null } catch {} }
    $tout = [Text.Encoding]::UTF8.GetString($ms.ToArray())
    if (-not $probleme -and $phase -eq 'connexion') {
        if ($tout -match '(?i)maximum (cli|ssh|telnet)? ?session|too many (sessions|users|connections)|session limit') { $probleme = 'sessions' }
        elseif ($tout -match '(?i)too many login failures|please wait for \d+ seconds|locked out') { $probleme = 'bloque' }
        elseif ($tout -match '(?i)authentication failed|login (invalid|incorrect|failed)') { $probleme = 'login' }
    }
    $err = ''; try { if ($tErr.Wait(3000)) { $err = $tErr.Result } } catch {}
    $octets = $ms.ToArray()
    $nCmd = @($marques | Where-Object { $_.Cmd -ne '(sortie)' }).Count
    Journal ("  fin : " + $octets.Length + " octets reçus, $nCmd commandes envoyées" + $(if ($probleme) { " | problème : $probleme" } else { '' }))
    return [pscustomobject]@{ Fini = ($fin -or $sorties -gt 0); Err = $err; Octets = $octets; Probleme = $probleme; Envoyees = $nCmd
                              Marques = $marques; Marque = $marque; Sauvegarde = $sauvegarde; Invite = $invite
                              Utilise = $courant; Suivant = $courant + 1; Commandes = ($phase -ne 'connexion'); Refus = $st.refus }
}

function Nettoyer($texte, $invite, $cmds) {
    $esc = [string][char]27
    $t = Sans-Codes $texte
    $t = $t -replace [string][char]0xFEFF, ''
    while ($t -match '[^\x08]\x08') { $t = $t -replace '[^\x08]\x08', '' }
    $t = $t -replace '\x08', ''
    $t = $t -replace "`r+`n", "`n" -replace "`r", "`n"
    if ($invite -and $invite -match '[A-Za-z0-9]') {
        # HP : « no pagePON-HDV-SWA-01# show system » : chaque invite repart en début de ligne
        $e = [regex]::Escape($invite)
        $t = [regex]::Replace($t, "(?<=[^\n])(?=$e(?:\([^)\n]*\))?[#>] )", "`n")
        # « show power-over-ethernet briefInvalid input » : la réponse repart à la ligne après la commande
        foreach ($c in @($cmds | Where-Object { $_ } | Sort-Object Length -Descending -Unique)) {
            $t = [regex]::Replace($t, "(?m)^($e(?:\([^)\n]*\))?[#>] ?" + [regex]::Escape($c) + ")(?=[A-Z%])", "`$1`n")
        }
    }
    return ($t -replace "`n", "`r`n")
}

# RouterOS écrit les accents en octets : « Jaur\C3\A8s » (ou « JaurC3A8s »)
function Decoder-RouterOS($t) {
    $dec = { param($hex) try { $b = [byte[]]@(for ($k = 0; $k -lt $hex.Length; $k += 2) { [Convert]::ToByte($hex.Substring($k, 2), 16) }); $s = [Text.Encoding]::UTF8.GetString($b); if ($s.IndexOf([char]0xFFFD) -ge 0) { $null } else { $s } } catch { $null } }
    $t = [regex]::Replace($t, '(?:\\[0-9A-Fa-f]{2})+', { param($m) $r = & $dec ($m.Value -replace '\\', ''); if ($r) { $r } else { $m.Value } })
    return [regex]::Replace($t, '(?<=[a-z])(?:[C-E][0-9A-F](?:[89AB][0-9A-F]){1,2})(?=[a-z\s]|$)', { param($m) $r = & $dec $m.Value; if ($r) { $r } else { $m.Value } })
}

function Resultat($ip, $etat, $detail) {
    return [pscustomobject]@{ IP = $ip; Nom = ''; Marque = ''; Identifiant = ''; Etat = $etat; Detail = $detail; Fichier = ''; Config = '' }
}
function Echec($ip, $msg) {
    $raison = ($msg -split "`n" | Where-Object { $_.Trim() -and $_ -notmatch '^(Looking up|Connecting to|We claim|Event Log|Doing|Using)' } | Select-Object -Last 1)
    if (-not $raison) { $raison = 'aucune réponse (switch éteint, IP fausse ou SSH désactivé ?)' }
    if ($msg -match 'Access denied|Authentication|authentification|password') { $raison = 'login ou mot de passe refusé' }
    return (Resultat $ip 'ÉCHEC' ([string]$raison).Trim())
}
$Refus = '(?i)invalid input|invalid command|incomplete command|unrecognized command|unknown command|bad command|syntax error|invalid word|incomplete word|no such interface|invalid port|expected end of command|% ?error'
$AuthRefusee = '(?i)access denied|password was not accepted|authentication (failed|refused)|no supported authentication|too many authentication failures|permission denied'

function Attendre-Blocage($ip) {
    Write-Host ''
    Write-Host ("    $ip a bloqué les connexions après des essais refusés : attente de $AttenteBlocage s avant l'identifiant suivant...") -ForegroundColor Yellow -NoNewline
    Journal "  switch bloqué : attente $AttenteBlocage s"
    Start-Sleep -Seconds $AttenteBlocage
    Write-Host ' reprise' -ForegroundColor Yellow
}

function Relever($ip, $mt) {
    Journal "=== $ip ==="
    $liste = @(Ordre-Ids $ip)   # (nom distinct de $Ids : PowerShell ne distingue pas les majuscules)
    $tmp  = Join-Path $env:TEMP ('carto_' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $script:tmpDir = $tmp
    try {
        $vide = Join-Path $tmp 'vide.txt'
        [IO.File]::WriteAllText($vide, '', [Text.Encoding]::ASCII)
        $script:hostkey = ''; $script:viaTelnet = $false
        # SSH : login et mot de passe passés à plink. Telnet : login demandé par le switch (le dialogue y répond).
        $base = { param($k) if ($script:viaTelnet) { "-load $Session -telnet -P 23" } else { "-load $Session -ssh -l $(Q $liste[$k].User) -pw $(Q $liste[$k].Pass)" + $script:hostkey } }
        $sshFerme = '(?i)connection refused|unexpectedly closed|connection abort|connection reset|closed by remote'
        $cle  = 'host key|hostkey|not cached|Cannot confirm'
        $reseau = 'Network error|timed out|refused|Unable to open connection|Host does not exist|No route'

        # Clé du switch inconnue : on reprend son empreinte dans le message de plink
        # et on la donne directement (-hostkey), sans aucune question à l'écran.
        function Accepter-Cle($txt) {
            $fp = ''
            $m = [regex]::Match($txt, 'SHA256:[A-Za-z0-9+/=]{20,}')
            if ($m.Success) { $fp = $m.Value } else {
                $m = [regex]::Match($txt, '(?i)\b[0-9a-f]{2}(?::[0-9a-f]{2}){15}\b')
                if ($m.Success) { $fp = $m.Value }
            }
            if ($fp) { Journal "  clé du switch acceptée : $fp"; $script:hostkey = " -hostkey $fp" }
            else { Journal '  empreinte de la clé introuvable dans le message de plink' }
        }

        # MikroTik : il s'annonce « ROSSSH » dès le début de la connexion.
        # Sonde SANS login ni mot de passe : elle ne peut jamais ouvrir de session sur le switch.
        if ($null -eq $mt) {
            $r = Lancer-Plink "-load $Session -ssh -l carto-sonde -v -batch $ip" $vide 15 '(?i)(remote|server) version:?\s*SSH-'
            if ($r.Err -notmatch '(?i)(remote|server) version' -and $r.Err -match $sshFerme) {
                Journal '  SSH fermé sur le switch : essai en Telnet'; $script:viaTelnet = $true
            } elseif ($r.Err -notmatch '(?i)(remote|server) version' -and $r.Err -match $reseau) { return (Echec $ip $r.Err)
            } elseif (-not $r.Fini -and $r.Err -notmatch '(?i)(remote|server) version|connected to|host key|ssh-') {
                return (Resultat $ip 'ÉCHEC' 'aucune réponse en 15 s sur le port 22 : pas d''équipement à cette IP, éteint, ou SSH filtré (vérifier avec ping)')
            }
            $mt = ($r.Err -match 'ROSSSH')
        }

        $k = 0; $marque = ''; $sauvegarde = ''; $cfgBrut = $null; $cleVue = $false
        if ($mt) {
            $marque = 'mikrotik'
            $sec = if ($CmdMarques['mikrotik']) { $CmdMarques['mikrotik'] } else { @{ Cmds = @('/system identity print'); Sauvegarde = '/export' } }
            $sauvegarde = $sec.Sauvegarde
            # MikroTik : une connexion par commande, sans terminal (sortie propre). Identifiants testés sur la 1re commande.
            $premier = $null
            while ($k -lt $liste.Count) {
                $c0 = $sec.Cmds[0]
                $premier = Lancer-Plink ((& $base $k) + " -batch $ip $(Q $c0)") $vide 60 $null
                if ($premier.Err -match $cle -and -not $cleVue) { $cleVue = $true; Accepter-Cle $premier.Err; $premier = Lancer-Plink ((& $base $k) + " -batch $ip $(Q $c0)") $vide 60 $null }
                if ($premier.Octets.Length -eq 0 -and $premier.Err -match $AuthRefusee) { Journal ("  identifiant « " + $liste[$k].User + " » refusé"); $k++; continue }
                break
            }
            if ($k -ge $liste.Count) { return (Resultat $ip 'ÉCHEC' "aucun des $($liste.Count) identifiants n'a été accepté") }
            if ($premier.Octets.Length -eq 0 -and $premier.Err -match $reseau) { return (Echec $ip $premier.Err) }
            $fini = $premier.Fini; $acc = New-Object Text.StringBuilder
            [void]$acc.Append("### $($sec.Cmds[0])`r`n").Append([Text.Encoding]::UTF8.GetString($premier.Octets)).Append("`r`n")
            foreach ($cmd in @($sec.Cmds | Select-Object -Skip 1)) {
                $r = Lancer-Plink ((& $base $k) + " -batch $ip $(Q $cmd)") $vide 60 $null
                if (-not $r.Fini) { $fini = $false }
                [void]$acc.Append("### $cmd`r`n").Append([Text.Encoding]::UTF8.GetString($r.Octets)).Append("`r`n")
            }
            $brut = [Text.Encoding]::UTF8.GetBytes($acc.ToString())
            if ($sauvegarde) {
                $rc = Lancer-Plink ((& $base $k) + " -batch $ip $(Q $sauvegarde)") $vide 90 $null
                if ($rc.Octets.Length) { $cfgBrut = $rc.Octets }
            }
            $invite = ''
        } else {
            # Une seule session par switch : connexion, marque, commandes et sauvegarde.
            # Si le switch refuse l'identifiant, on passe au suivant de la liste.
            $r = $null
            while ($k -lt $liste.Count) {
                $r = Dialoguer ((& $base $k) + $(if ($script:viaTelnet) { " -batch $ip" } else { " -batch -t $ip" })) $liste $k $Delai
                if (-not $script:viaTelnet -and $r.Octets.Length -eq 0 -and $r.Err -match $sshFerme) { Journal '  SSH coupé par le switch : essai en Telnet'; $script:viaTelnet = $true; continue }
                if ($r.Octets.Length -eq 0 -and $r.Err -match $cle -and -not $cleVue) { $cleVue = $true; Accepter-Cle $r.Err; continue }
                if ($r.Octets.Length -eq 0 -and $r.Err -match $AuthRefusee) { Journal ("  identifiant « " + $liste[$k].User + " » refusé"); $k++; continue }
                if ($r.Probleme -eq 'login') { $k = $r.Suivant; continue }
                if ($r.Probleme -eq 'bloque' -and $r.Suivant -lt $liste.Count) { Attendre-Blocage $ip; $k = $r.Suivant; continue }
                $k = $r.Utilise
                break
            }
            if ($k -ge $liste.Count -or ($r -and $r.Probleme -eq 'login')) { return (Resultat $ip 'ÉCHEC' "aucun des $($liste.Count) identifiants n'a été accepté") }
            $txtPb = @{
                sessions = 'trop de sessions ouvertes sur le switch : fermez les fenêtres PuTTY et réessayez dans 10 à 15 min'
                bloque   = 'switch bloqué après des échecs de login : réessayez dans quelques minutes'
            }
            if ($r.Probleme) { return (Resultat $ip 'ÉCHEC' $txtPb[$r.Probleme]) }
            if ($script:viaTelnet -and $r.Octets.Length -eq 0) { return (Resultat $ip 'ÉCHEC' "SSH et Telnet refusés par le switch (activer SSH dans son interface web)") }
            if (-not $r.Commandes -or $r.Envoyees -eq 0) { return (Echec $ip $r.Err) }
            $fini = $r.Fini; $brut = $r.Octets; $marque = $r.Marque; $sauvegarde = $r.Sauvegarde; $invite = $r.Invite
            if ($brut.Length -lt 200) { return (Echec $ip $r.Err) }
            # on sort la configuration du relevé : elle va dans son propre fichier
            $mq = @($r.Marques)
            $jCfg = -1; for ($j = 0; $j -lt $mq.Count; $j++) { if ($sauvegarde -and $mq[$j].Ligne -eq $sauvegarde) { $jCfg = $j } }   # dernier essai = celui accepté
            if ($jCfg -ge 0) { $sauvegarde = $mq[$jCfg].Cmd }
            for ($j = [Math]::Max($jCfg, 0); $j -lt $mq.Count; $j++) {
                if ($jCfg -ge 0 -and $j -eq $jCfg) {
                    $d = [int]$mq[$j].Debut
                    $f = if ($j + 1 -lt $mq.Count) { [int]$mq[$j + 1].Debut } else { $brut.Length }
                    if ($f -gt $d) {
                        $cfgBrut = New-Object byte[] ($f - $d); [Array]::Copy($brut, $d, $cfgBrut, 0, $f - $d)
                        $reste = New-Object byte[] ($brut.Length - ($f - $d))
                        [Array]::Copy($brut, 0, $reste, 0, $d); [Array]::Copy($brut, $f, $reste, $d, $brut.Length - $f)
                        $brut = $reste
                    }
                    break
                }
            }
        }
        Retenir $ip $liste[$k].Id
        $login = $liste[$k].User
        $nomMarque = if ($marque -eq 'mikrotik') { 'MikroTik' } elseif ($Profils[$marque]) { $Profils[$marque].Nom } else { '' }

        $texte = [Text.Encoding]::UTF8.GetString($brut)
        if ($texte.IndexOf([char]0xFFFD) -ge 0) { $texte = [Text.Encoding]::GetEncoding(1252).GetString($brut) }
        $texte = Nettoyer $texte $invite $(if ($mt) { @() } else { @($r.Marques | ForEach-Object { $_.Cmd }) })

        # nom du switch : prompt (« SW01# », « <SW01> », « admin@SW01> », « Souris Verte # »), ou identity MikroTik
        $nom = ($invite -replace '^<', '' -replace '^[^@\s]+@', '' -replace '^\*\s*', '' -replace '\(.*$', '').Trim()
        if ($mt) { $m = [regex]::Match($texte, '(?m)^\s*name:\s*(.+?)\s*$'); if ($m.Success) { $nom = Decoder-RouterOS $m.Groups[1].Value } }
        $base2 = if ($nom) { "$nom ($ip)" } else { $ip }
        $base2 = Nom-Fichier $base2
        $fichier = Join-Path $Logs ($base2 + '.txt')
        if (Test-Path $fichier) {
            Move-Item -Path $fichier -Destination (Join-Path $Logs ($base2 + ' - ancien ' + (Get-Date -Format 'yyyy-MM-dd HHmmss') + '.txt')) -Force
        }
        $entete = "# Relevé Carto Réseau - $ip - " + (Get-Date -Format 'dd/MM/yyyy HH:mm') + " - site : $NomSite - script : v$VersionScript - marque : $nomMarque`r`n"
        [IO.File]::WriteAllText($fichier, $entete + $texte, (New-Object Text.UTF8Encoding($true)))

        $config = 'non demandée'
        if ($cfgBrut) {
            $ct = [Text.Encoding]::UTF8.GetString($cfgBrut)
            if ($ct.IndexOf([char]0xFFFD) -ge 0) { $ct = [Text.Encoding]::GetEncoding(1252).GetString($cfgBrut) }
            $lignes = @((Nettoyer $ct) -split "`r`n")
            if ($lignes.Count -and $lignes[0] -match [regex]::Escape($sauvegarde)) { $lignes = @($lignes | Select-Object -Skip 1) }
            $n = $lignes.Count
            while ($n -gt 0 -and ($lignes[$n - 1].Trim() -eq '' -or $lignes[$n - 1] -match '^\S{1,60}[#>\]]\s*$' -or $lignes[$n - 1] -match '^<[^>]+>\s*$')) { $n-- }
            $lignes = if ($n -gt 0) { @($lignes[0..($n - 1)]) } else { @() }
            $utiles = @($lignes | Where-Object { $_.Trim() }).Count
            if ($utiles -ge 5) {
                $fCfg = Join-Path $Configs ($base2 + ' - ' + (Get-Date -Format 'yyyy-MM-dd HHmm') + '.txt')
                $enteteCfg = "# Configuration ($sauvegarde) - $nom ($ip) - site : $NomSite - " + (Get-Date -Format 'dd/MM/yyyy HH:mm') + "`r`n"
                [IO.File]::WriteAllText($fCfg, $enteteCfg + ($lignes -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding($true)))
                $config = 'sauvegardée'
                Journal "  configuration sauvegardée : $fCfg"
            } else { $config = 'refusée par le switch'; Journal '  configuration : commande refusée ou sortie vide' }
        } elseif ($sauvegarde) { $config = 'non reçue' }

        $etat = if ($fini) { 'OK' } else { "OK (coupé après $Delai s)" }
        $inval = if ($mt) { ([regex]::Matches($texte, $Refus)).Count } else { [int]$r.Refus }
        $detail = if ($inval) { "$inval commande(s) refusée(s) par le switch (normal pour les commandes d'une autre gamme)" } else { '' }
        if ($script:viaTelnet) { $detail = ('relevé en Telnet (SSH fermé sur le switch). ' + $detail).Trim() }
        return [pscustomobject]@{ IP = $ip; Nom = $nom; Marque = $nomMarque; Identifiant = $login; Etat = $etat; Detail = $detail; Fichier = $fichier; Config = $config }
    }
    finally { Start-Sleep -Milliseconds 200; Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

# ---------------- boucle principale ----------------
$bilan = @()
$fBilan = Join-Path $Logs '_bilan.csv'
if ((Test-Path $fBilan) -and -not (Select-String -Path $fBilan -Pattern '"Marque"' -Quiet)) { Move-Item $fBilan (Join-Path $Logs '_bilan (ancien).csv') -Force }
$premier = $true
while ($true) {
    $nbListe = @(Get-Content $fListe -Encoding UTF8 | Where-Object { $_ -match '^\s*\d{1,3}(\.\d{1,3}){3}' }).Count
    Titre "Switch(s) à relever - site $NomSite"
    Write-Host "Tapez une IP, ou plusieurs séparées par des espaces."
    if ($premier -and $nbListe) { Write-Host "Entrée seule : les $nbListe switch(s) de switchs.txt du site." }
    elseif ($premier) { Write-Host "(Astuce : listez les IP du site dans $fListe pour tout relever d'un coup.)" -ForegroundColor DarkGray }
    else { Write-Host "Entrée seule : terminer." }
    $saisie = Read-Host 'IP'

    $cibles = @()
    if (-not $saisie.Trim()) {
        if ($premier -and $nbListe) {
            foreach ($l in (Get-Content $fListe -Encoding UTF8)) {
                $t = @($l.Trim() -split '[\s;,]+')
                if ($t[0] -match '^\d{1,3}(\.\d{1,3}){3}$') { $cibles += [pscustomobject]@{ IP = $t[0]; MT = $(if ($l -match '(?i)mikrotik|routeros') { $true } else { $null }) } }
            }
        } elseif ($premier) { continue } else { break }
    } else {
        $ips = @($saisie -split '[\s,;]+' | Where-Object { $_ })
        $cibles = @($ips | ForEach-Object { [pscustomobject]@{ IP = $_; MT = $null } })
        # les nouvelles IP sont ajoutées à switchs.txt du site
        $connues = @(Get-Content $fListe -Encoding UTF8 | ForEach-Object { ($_.Trim() -split '[\s;,]+')[0] })
        $ajout = @($ips | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' -and $connues -notcontains $_ })
        if ($ajout.Count) { Add-Content -Path $fListe -Value $ajout -Encoding UTF8 }
    }
    $premier = $false

    foreach ($cible in $cibles) {
        $ip = $cible.IP
        if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Write-Host "  $ip : ce n'est pas une adresse IP, ignorée." -ForegroundColor Yellow; continue }
        Write-Host ("  {0,-16} relevé en cours..." -f $ip) -NoNewline
        $r = Relever $ip $cible.MT
        if ($r.Etat -like 'OK*') {
            Write-Host (" {0}  {1}  ({2}, login {3})" -f $r.Etat, $r.Nom, $r.Marque, $r.Identifiant) -ForegroundColor Green
            if ($r.Detail) { Write-Host ("                   " + $r.Detail) -ForegroundColor DarkYellow }
            if ($r.Config -eq 'sauvegardée') { Write-Host '                   configuration sauvegardée' -ForegroundColor DarkGray }
            elseif ($r.Config -and $r.Config -ne 'non demandée') { Write-Host ("                   configuration " + $r.Config) -ForegroundColor Yellow }
        } else {
            Write-Host (" ÉCHEC : " + $r.Detail) -ForegroundColor Red
            if ($r.Detail -match 'identifiant|login') {
                $c = Read-Host '  Ajouter un identifiant et réessayer ce switch ? (O/N)'
                if ($c -match '^[oO]') {
                    $n = Nouvel-Id
                    if ($n) {
                        [void]$Ids.Add($n); Sauver-Ids
                        Write-Host ("  {0,-16} nouvel essai..." -f $ip) -NoNewline
                        $r = Relever $ip $cible.MT
                        if ($r.Etat -like 'OK*') { Write-Host (" {0}  {1}  ({2}, login {3})" -f $r.Etat, $r.Nom, $r.Marque, $r.Identifiant) -ForegroundColor Green }
                        else { Write-Host (" ÉCHEC : " + $r.Detail) -ForegroundColor Red }
                    }
                }
            }
        }
        $bilan += $r
        $r | Select-Object @{n='Date';e={Get-Date -Format 'yyyy-MM-dd HH:mm'}}, @{n='Site';e={$NomSite}}, IP, Nom, Marque, Identifiant, Etat, Detail, Fichier, Config |
            Export-Csv -Path $fBilan -Delimiter ';' -NoTypeInformation -Encoding UTF8 -Append
    }
}

Titre 'Terminé'
$ok = @($bilan | Where-Object { $_.Etat -like 'OK*' }).Count
Write-Host "$ok switch(s) relevé(s) sur $($bilan.Count) - site $NomSite. Fichiers dans :"
Write-Host "  $Logs" -ForegroundColor Cyan
Write-Host "Configurations sauvegardées dans :"
Write-Host "  $Configs" -ForegroundColor Cyan
Write-Host "Importez les .txt dans Carto Réseau (bouton Importer)."
try { Start-Process explorer.exe -ArgumentList ('"' + $Logs + '"') } catch {}
Read-Host 'Entrée pour fermer' | Out-Null
