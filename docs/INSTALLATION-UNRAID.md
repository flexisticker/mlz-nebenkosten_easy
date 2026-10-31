# Vermieter-Portal auf Unraid installieren

Ein Container (`vermieter-portal`, Port 8280 → 8080). GitHub baut das Image bei jeder Änderung
automatisch und legt es unter `ghcr.io/flexisticker/mlz-nebenkosten-easy:latest` ab.

## 1. Paket-Zugang

Das Repository ist öffentlich, das Image lässt sich normalerweise ohne Anmeldung laden.
Meldet Unraid beim Laden „denied“ oder „unauthorized“: wie bei Flex-Studio mit dem vorhandenen
GitHub-Token (`read:packages`) bei `ghcr.io` anmelden, oder auf GitHub unter
Packages → mlz-nebenkosten-easy → Package settings die Sichtbarkeit auf „Public“ stellen.

## 2. Container anlegen

1. `unraid/vermieter-portal.xml` nach `/boot/config/plugins/dockerMan/templates-user/my-vermieter-portal.xml` kopieren.
   Im Unraid-Terminal geht das in einem Schritt:
   ```bash
   wget -O /boot/config/plugins/dockerMan/templates-user/my-vermieter-portal.xml https://raw.githubusercontent.com/flexisticker/mlz-nebenkosten_easy/main/unraid/vermieter-portal.xml
   ```
2. Docker → „Add Container“ → Vorlage `vermieter-portal` → Apply.
   - Port: `8280` (frei wählbar)
   - Daten: `/mnt/user/appdata/vermieter-portal`
3. Im Heimnetz öffnen: `http://<IP des Servers>:8280`
4. Beim ersten Start „Meine Datensicherung (.json) importieren“ wählen. PDFs danach unter **Dokumente** hochladen.

## 3. Aktualisieren

Docker → `vermieter-portal` → „Check for Updates“ → „Apply Update“. Der Datenordner bleibt erhalten.

## 4. Wichtig: nur im Heimnetz

Das Portal hat keine Anmeldung. Es **nicht** im Nginx Proxy Manager freigeben und keine
Portweiterleitung im Router einrichten. Von unterwegs nur per VPN (z. B. WireGuard in Unraid).

## 5. Sichern

Alles liegt in `/mnt/user/appdata/vermieter-portal`. Das Plugin „Appdata Backup“ sichert den Ordner mit.
