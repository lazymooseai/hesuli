---
name: Venue → Tolppa mapping
description: Tapahtumat ja venuet linkitetään lähimpään taksitolppaan override+geo+token-haulla; käyttäjä voi korjata käsin
type: feature
---

## Logiikka (`src/lib/tolppaLocations.ts`)

`findTolppaForVenue(venue)` etsii sopivimman tolpan järjestyksessä:
1. **Override-mappi** (`VENUE_TOLPPA_OVERRIDES`)
2. **Geo-fallback** (`VENUE_GEO`) → `findNearestTolppa`
3. **Token-haku** (`findTolppaSmart`)

## Viralliset Taksi Helsingin tolppanumerot (käyttäjän vahvistamat)
Lähde: käyttäjän toimittama `Tolpat_ja_ruudut.txt`.
- 4 KÄMP, 6 SENAATINTORI/Aleksanterinkatu (Säätytalo), 11 RUOHOLAHTI
- 14 RAUTATIENTORI, 19 SEASIDE/Finlandia
- 21 EROTTAJA (Savoy), 27 LINNANMÄKI (HKT-alue)
- 25 KALASATAMA (Teurastamo, Tukkutori, Suvilahti)
- 26 KALLIO/STURENKATU (Kulttuuritalo, Konepaja Vallila)
- 35 LASIPALATSI (Pikkuparlamentti/Presidentti)
- 37 ELIELINAUKIO (asema-aukio), 39 ELIELINAUKIO Musiikkitalo
- 41 MUSEOKATU (Eduskunta, Storyville)
- 44 MALMI (Malmitalo, Ala-Malmin tori)
- 45 TÖÖLÖNTORI (käyttäjä: Stadion-alue tolppa 52 Itä-Töölö, ei 45)
- 52 TOIVONKATU/JAKOMÄKI (käyttäjäyhdistys: Ooppera/Itä-Töölö → 52)
- 59 KAMPPI, 79 VEIKKAUS AREENA, 96 SIMONKENTTÄ
- 422 TIKKURILA, 440 KERÄILY LENTOAS.

HUOM: Olympiastadion ja HKT (Kaupunginteatteri) on käyttäjän pyynnöstä
mapattu tolppaan **52 Ooppera/Itä-Töölö**, vaikka virallinen lista ei suoraan
vastaa tätä — käyttäjällä on alue­tuntemus.
Suomalainen Klubi → **96 Simonkenttä** (ei Kasarmikatu).
Urheilumuseo "Tahdon tarina" suodatetaan pois LinkedEventsista (pieni
näyttely, ei taksikysyntää) — `linkedEvents.ts` NOISE_PATTERNS sisältää
/tahdon tarina/, /urheilumuseo/, /näyttely/.
Eduskunnan täysistunnot suodatetaan kokonaan pois Wikidata-syötteestä ja
kannasta — vanhentuneita/vääriä aikatauluja. Käyttäjä lisää tarvittaessa
manuaalisesti Hallinta-välilehdeltä.

## Manuaaliset overridet (`src/lib/manualTolppaOverrides.ts`)
- Käyttäjä voi korjata yksittäisen tapahtuman tolpan kynänappi-iconilla kortin alanurkasta.
- Tallennus localStorageen avaimella `manual-tolppa-overrides:v1`.
- `getManualTolppa(itemId)` palauttaa: `undefined` (ei overridea), `null` (poistettu), tai TolppaLocation.
- `EventsTimeline` kuuntelee `manual-tolppa-changed` eventtiä ja päivittyy heti.

## Eduskunta-kalenteri poistettu
`fetch-political-news` ei enää generoi `eduskunta-cal` -rivejä:
eduskunta.fi uudistui ja vakioaikataulut antoivat vääriä päiviä (kesätauot,
valiokuntakäsittelyt). Edge function siivoaa myös vanhat rivit `delete .eq('source','eduskunta-cal')`.
Käyttäjä voi lisätä täysistunnot manuaalisesti Hallinta-välilehdeltä.
