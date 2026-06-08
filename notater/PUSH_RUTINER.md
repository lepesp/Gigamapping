# Push-rutiner

## Hva er dette?
En automatisk sjekkliste som kjøres før kode pushes til produksjon. Den finner feil, advarsler, og forbereder en commit-melding.

## Hvordan bruke
Skriv i chatten:
```
kjør push rutiner
```

## Hva den gjør

### Fase 1 — Kodesjekk
| Sjekk | Type | Beskrivelse |
|-------|------|-------------|
| Produksjonsbygg | ❌ Kritisk | Verifiserer at `vite build` fungerer |
| Console.log | ⚠️ Advarsel | Finner glemte console.log i koden |
| Hardkodede secrets | ❌ Kritisk | Søker etter API-nøkler i kildekoden |
| Env-variabler | ⚠️ Advarsel | Sjekker at alle refererte env-variabler finnes |

### Fase 2 — Database
| Sjekk | Type | Beskrivelse |
|-------|------|-------------|
| Firestore-regler | ⚠️ Advarsel | Sjekker om `firestore.rules` er endret og minner om oppdatering i konsollen |
| Data-typer | ⚠️ Advarsel | Verifiserer at interfaces matcher Firestore-felter |

### Fase 3 — Git
- Viser `git status` og `git diff --stat`
- Foreslår en beskrivende commit-melding på norsk

### Fase 4 — Rapport
- Samlet oversikt over bestått / advarsler / feil
- Spør om du vil fikse feil eller committe
- **Pusher ALDRI uten at du eksplisitt sier "push"**

## Eksempel output
```
## 🚀 Push-rutiner — Resultat

### ✅ Bestått
- Bygg: OK
- Secrets: Ingen funnet

### ⚠️ Advarsler
- 1x console.log i ShareModal.jsx

### 📝 Foreslått commit-melding
feat: legg til invitasjonslenker og e-post-innlogging
```
