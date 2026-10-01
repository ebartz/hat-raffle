import { Injectable, computed, inject } from '@angular/core';
import { SettingsService } from './settings.service';

const TEXTS = {
  en: {
    readyTitle: 'Get your badge scanned',
    readySubtitle: 'and with a little luck win an original red Fedora!',
    readyHint: 'Just talk to us – we will scan your badge',
    processing: 'One moment …',
    winTitle: 'Congratulations!',
    winSubtitle: 'You are participant #{n} – a prime number! Pick up your Fedora at the booth.',
    loseTitle: 'Thanks for playing!',
    loseSubtitle: 'You are participant #{n}. Not a prime this time – no Fedora, sorry.',
    loseSubtitleCode: 'Your code is not a prime number – no Fedora this time.',
    winSubtitleCode: 'Your code is a prime number! Pick up your Fedora at the booth.',
    winSubtitleRandom: 'You are participant #{n} and you won! Pick up your Fedora at the booth.',
    loseSubtitleRandom: 'You are participant #{n}. Luck was not on your side this time.',
    loseTeaser: 'Come and talk to us anyway – we are happy to see you!',
    duplicateTitle: 'Already in!',
    duplicateSubtitle: 'This badge has already been registered as participant #{n}.',
    duplicateHintWinner: 'You have already won a Fedora.',
    duplicateHintLoser: 'Every badge can take part only once.',
    soldOutTitle: 'A prime – but …',
    soldOutSubtitle: '… all Fedoras are gone already. Thanks for playing!',
    errorTitle: 'Something went wrong',
    errorSubtitle:
      'The server cannot be reached right now. Please try again or ask our booth staff.',
    statsParticipants: 'Participants',
    statsWinners: 'Fedoras won',
    statsLeft: 'Fedoras left',
    idleHeadlines: [
      'Win a Fedora!',
      'Want a red Fedora?',
      'Get your badge scanned!',
      'Join in & win!',
      'While stocks last!',
    ],
    idleCta: 'Talk to us – we scan your badge',
    idleRuleCounter: 'If your participant number is prime, the Fedora is yours.',
    idleRuleCode: 'If your badge number is prime, the Fedora is yours.',
    idleRuleRandom: 'With a bit of luck one of our red Fedoras is yours.',
    cameraTitle: 'Scan badge',
    cameraHint: 'Hold the QR or barcode of the badge inside the frame',
    cameraStarting: 'Starting camera …',
    cameraInsecure:
      'The camera is only available via HTTPS (or localhost). Start the backend with TLS_CERT/TLS_KEY and open the https address.',
    cameraDenied: 'No access to the camera. Please allow it in the browser settings.',
    cameraError: 'The camera could not be started.',
    cameraRetry: 'Try again',
    manualPlaceholder: 'Enter code manually',
    remoteStation: 'Station {s}',
    enableVibration: 'Tap once to enable vibration',
  },
  de: {
    readyTitle: 'Lass deinen Ausweis scannen',
    readySubtitle: 'und gewinne mit etwas Glück eine original rote Fedora!',
    readyHint: 'Sprich uns einfach an – wir scannen deinen Ausweis',
    processing: 'Einen Moment …',
    winTitle: 'Glückwunsch!',
    winSubtitle: 'Du bist Teilnehmer Nr. {n} – eine Primzahl! Hol dir deine Fedora am Stand ab.',
    loseTitle: 'Danke fürs Mitmachen!',
    loseSubtitle: 'Du bist Teilnehmer Nr. {n}. Leider keine Primzahl – diesmal keine Fedora.',
    loseSubtitleCode: 'Dein Code ist leider keine Primzahl – diesmal keine Fedora.',
    winSubtitleCode: 'Dein Code ist eine Primzahl! Hol dir deine Fedora am Stand ab.',
    winSubtitleRandom:
      'Du bist Teilnehmer Nr. {n} und hast gewonnen! Hol dir deine Fedora am Stand ab.',
    loseSubtitleRandom:
      'Du bist Teilnehmer Nr. {n}. Diesmal war das Glück leider nicht auf deiner Seite.',
    loseTeaser: 'Sprich uns trotzdem an – wir freuen uns auf dich!',
    duplicateTitle: 'Schon dabei!',
    duplicateSubtitle: 'Dieser Ausweis wurde bereits als Teilnehmer Nr. {n} erfasst.',
    duplicateHintWinner: 'Du hast bereits eine Fedora gewonnen.',
    duplicateHintLoser: 'Jeder Ausweis kann nur einmal teilnehmen.',
    soldOutTitle: 'Primzahl – aber …',
    soldOutSubtitle: '… alle Fedoras sind leider schon vergeben. Danke fürs Mitmachen!',
    errorTitle: 'Das hat nicht geklappt',
    errorSubtitle:
      'Der Server ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal oder sprich das Standpersonal an.',
    statsParticipants: 'Teilnehmer',
    statsWinners: 'Fedoras gewonnen',
    statsLeft: 'Fedoras übrig',
    idleHeadlines: [
      'Win a Fedora!',
      'Du willst eine rote Fedora?',
      'Lass deinen Ausweis scannen!',
      'Mitmachen & gewinnen!',
      'Nur solange der Vorrat reicht!',
    ],
    idleCta: 'Sprich uns an – wir scannen deinen Ausweis',
    idleRuleCounter: 'Ist deine Teilnehmernummer eine Primzahl, gehört die Fedora dir.',
    idleRuleCode: 'Ist deine Ausweisnummer eine Primzahl, gehört die Fedora dir.',
    idleRuleRandom: 'Mit etwas Glück gehört eine unserer roten Fedoras dir.',
    cameraTitle: 'Ausweis scannen',
    cameraHint: 'QR- oder Barcode des Ausweises in den Rahmen halten',
    cameraStarting: 'Kamera wird gestartet …',
    cameraInsecure:
      'Die Kamera ist nur über HTTPS (oder localhost) verfügbar. Bitte das Backend mit TLS_CERT/TLS_KEY starten und die https-Adresse öffnen.',
    cameraDenied: 'Kein Zugriff auf die Kamera. Bitte in den Browser-Einstellungen erlauben.',
    cameraError: 'Die Kamera konnte nicht gestartet werden.',
    cameraRetry: 'Erneut versuchen',
    manualPlaceholder: 'Code manuell eingeben',
    remoteStation: 'Station {s}',
    enableVibration: 'Einmal tippen, um die Vibration zu aktivieren',
  },
} as const;

type TextKey = {
  [K in keyof (typeof TEXTS)['en']]: (typeof TEXTS)['en'][K] extends string ? K : never;
}[keyof (typeof TEXTS)['en']];

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);
  readonly texts = computed(() => TEXTS[this.settings.settings().language] ?? TEXTS.en);

  t(key: TextKey, params: Record<string, string | number> = {}): string {
    return (this.texts()[key] as string).replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ''));
  }
}
