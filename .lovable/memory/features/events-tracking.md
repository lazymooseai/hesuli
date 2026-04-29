---
name: Events Tracking
description: Helsinki events fetching from LinkedEvents API + DB overrides + fallback
type: feature
---

## Lahteet (prioriteettijarjestyksessa)

1. **DB `events`-taulu** — manuaaliset overridet (kuljettajan lisaykset) + scrape-events output. Ensisijainen.
2. **LinkedEvents API** (`api.hel.fi/linkedevents/v1`) — julkinen, ei vaadi avainta. Hakee yso-keywordeilla:
   - `p360` kulttuuritapahtumat, `p1808` konsertit, `p13084` teatteri,
   - `p11185` ooppera, `p20421` festivaalit
3. **scrape-klubi** edge function — Helsingin Suomalaisen Klubin tapahtumat
   suoraan `tapahtumat.klubi.fi`-staattisesta HTML:sta (ei vaadi APIa).
   Tunnistaa "TÄYNNÄ"/loppuunmyynti-tilan summary-tekstista.
4. **scrape-events** edge function — valinnainen Firecrawl-pohjainen rikastus (vaatii `FIRECRAWL_API_KEY`). Voi olla pois kaytosta jos cronia ei ole asetettu.

## Audience profiling

`src/lib/audienceProfile.ts` arvioi venuen+nimen+ajan perusteella tapahtuman
kohdeyleison: senior / adult / business / young_adult / youth / family / mixed.
Affinity 0..100 lisataan TimelineItemin weightiin (max +50). Tagit:
- BUSINESS, TAKSIYLEISÖ, TAKSIBOOST, POTENTIAALI näytetään korteissa.

## Toteutus

- `src/lib/linkedEvents.ts` — `fetchLinkedEvents()` hakee 7 pv ikkunan, suodattaa "kohinan" (kirjastojumpat, perhekerhot, senior-toiminta).
- `src/lib/events.ts` — `fetchEventsBundle()` yhdistaa DB + LinkedEvents (DB voittaa duplikaattikonfliktissa nimi+paiva-avaimen perusteella).
- Kategorisointi: `src/lib/eventCategories.ts` `categorizeEvent(name, venue)` — nimipohjainen tunnistus voittaa venue-pohjaisen.

## Suodattimet

- super_event_type === "recurring" -> ohitetaan paataso, alalevelit kayvat
- start_time alle -30 min ohittunut -> pois
- start_time yli 7 pv eteen -> pois
- "Kohinasanasto": jumppa, kirjasto, leikkipuisto, perhekerho, vauva, senior, palvelukeskus, kerho, opastus, klinikka

## Pisteytys (kysyntataso)

- capacity >= 5000 -> red ("ISO TAPAHTUMA")
- capacity >= 1500 + konsertti/show-sana -> red ("KONSERTTI")
- konsertti/show-sana muuten -> amber ("PREMIUM")
- capacity >= 800 -> amber ("TEATTERI")
- muut -> green ("TAPAHTUMA")
