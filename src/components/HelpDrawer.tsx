/**
 * HelpDrawer.tsx
 *
 * Käyttöohje kuljettajalle. Selittää selkeästi ja lyhyesti mitä
 * sovelluksen kukin osa tekee, mistä data tulee ja milloin hälyttää.
 */

import { HelpCircle, Radar, TrainFront, TrendingUp, Settings, Plane, Ship, Ticket, Trophy, Cloud, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

const HelpDrawer = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="h-11 w-11 rounded-lg bg-card border border-border flex items-center justify-center active:scale-95 transition-all"
          aria-label="Käyttöohje"
          title="Käyttöohje"
        >
          <HelpCircle className="h-6 w-6 text-primary" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black uppercase tracking-wide">Käyttöohje</SheetTitle>
          <SheetDescription className="text-base">
            Helsinki Taxi Pulse — kuljettajan tilannekuva ja kysyntähälytin.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-base leading-relaxed pb-12">
          <Section icon={<Radar className="h-5 w-5 text-primary" />} title="Tutka — yleiskuva NYT">
            Näyttää tärkeimmän hälytyksen ja parhaat ajoalueet juuri nyt.
            Suosittelu lasketaan junien myöhästymisistä, laivojen
            matkustajamääristä, säätilasta ja meneillään olevista tapahtumista.
            <Bullet>
              <strong className="text-destructive">Punainen JACKPOT</strong> = useita
              tekijöitä yhdessä paikassa (esim. iso laiva + sade).
            </Bullet>
            <Bullet>
              <strong className="text-accent">Keltainen</strong> = yksittäinen vahva signaali.
            </Bullet>
          </Section>

          <Section icon={<TrainFront className="h-5 w-5 text-primary" />} title="Liikenne — saapumiset">
            Kerää saapuvat <strong>lennot</strong> (Finavia),
            <strong> junat</strong> (Fintraffic — vaihda Hki/Pasila/Tikkurila),
            ja <strong>laivat</strong> (Helsingin satama + Averio-arvio).
            <Bullet>
              Ohi menneet näytetään 30 min ajan haalennettuina.
            </Bullet>
            <Bullet>
              Vihreä piste = LIVE-data, harmaa = aikataulu.
            </Bullet>
          </Section>

          <Section icon={<TrendingUp className="h-5 w-5 text-primary" />} title="Säpinä — tapahtumat & kysyntä">
            Aikajana 4 kategoriassa: <strong>Asemat</strong>,
            <strong> Kulttuuri</strong>, <strong>Urheilu</strong>, <strong>Muut</strong>.
            Lähteet: oma DB (manuaaliset lisäykset), LinkedEvents (Helsingin
            tapahtumakanta), Tavastia/Klubi-keikat ja sportskannaus.
            <Bullet>
              <Ticket className="inline h-4 w-4 text-accent mr-1" />
              <strong>TAKSIYLEISÖ / BUSINESS</strong> -tagit nostavat tapahtuman
              kärkeen — yleisön ikäjakauma 30–100 ennustetaan venuen ja artistin
              perusteella. Esim. Malmitalo + Topmost = vahva taksiboost.
            </Bullet>
            <Bullet>
              Korttia painamalla aukeaa virallinen lippu-/info-sivu.
            </Bullet>
          </Section>

          <Section icon={<Settings className="h-5 w-5 text-primary" />} title="Hallinta">
            Reittityökalut, kyytihistoria ja palautenappi. Täältä voit lisätä
            manuaalisesti tapahtumia (esim. yksityistilaisuudet) jotka muut
            lähteet eivät huomaa.
          </Section>

          <Section icon={<Cloud className="h-5 w-5 text-accent" />} title="Sää & sademodus">
            Sade tai lumi yli 1.0 mm/h aktivoi <em>sademoduksen</em> — kysyntä
            kerrointa nostetaan ×1.5 koko kaupungissa. Liukkausindeksi ≥ 0.6
            antaa sairaalasignaalin (Meilahti/Jorvi/Peijas).
          </Section>

          <Section icon={<AlertTriangle className="h-5 w-5 text-destructive" />} title="Hälytysperiaatteet">
            <Bullet>
              <Plane className="inline h-4 w-4 text-foreground mr-1" />
              Lento yli 30 min myöhässä + iso kone → keltainen Aasia/USA-tagi.
            </Bullet>
            <Bullet>
              <Ship className="inline h-4 w-4 text-foreground mr-1" />
              Laiva &gt; 2000 hlö → punainen, &gt; 1000 hlö → keltainen.
            </Bullet>
            <Bullet>
              <Trophy className="inline h-4 w-4 text-foreground mr-1" />
              Ottelu/konsertti &gt; 5000 hlö → ISO TAPAHTUMA, alkaa boostata 2h
              ennen ja päättymisen aikana.
            </Bullet>
          </Section>

          <Section icon={<HelpCircle className="h-5 w-5 text-muted-foreground" />} title="Päivittäminen">
            Data päivittyy automaattisesti taustalla (junat 2 min, laivat ja
            tapahtumat 5 min). Yläkulman <strong>↻ Päivitä</strong> -nappi pakottaa
            haut heti. <strong>Lokit</strong>-nappi näyttää viimeisimmät virheet
            jos jokin syöte ei toimi.
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
    <h3 className="flex items-center gap-2 text-lg font-black text-foreground">
      {icon}
      {title}
    </h3>
    <div className="text-sm text-muted-foreground space-y-2">{children}</div>
  </section>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <p className="pl-3 border-l-2 border-primary/40 text-foreground/90">{children}</p>
);

export default HelpDrawer;
