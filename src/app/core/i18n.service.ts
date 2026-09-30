import { Injectable, computed, inject } from '@angular/core';
import { SettingsService } from './settings.service';

const TEXTS = {
  de: {
    readyTitle: 'Lass deinen Ausweis scannen',
    readySubtitle: 'und gewinne mit etwas Glück einen original roten Hut!',
    readyHint: 'Sprich uns einfach an – wir scannen deinen Ausweis',
    processing: 'Einen Moment …',
    winTitle: 'Glückwunsch!',
    winSubtitle: 'Du bist Teilnehmer Nr. {n} – eine Primzahl! Hol dir deinen Red Hat am Stand ab.',
    loseTitle: 'Danke fürs Mitmachen!',
    loseSubtitle: 'Du bist Teilnehmer Nr. {n}. Leider keine Primzahl – diesmal kein Hut.',
    loseSubtitleCode: 'Dein Code ist leider keine Primzahl – diesmal kein Hut.',
    winSubtitleCode: 'Dein Code ist eine Primzahl! Hol dir deinen Red Hat am Stand ab.',
    winSubtitleRandom:
      'Du bist Teilnehmer Nr. {n} und hast gewonnen! Hol dir deinen Red Hat am Stand ab.',
    loseSubtitleRandom:
      'Du bist Teilnehmer Nr. {n}. Diesmal war das Glück leider nicht auf deiner Seite.',
    loseTeaser: 'Sprich uns trotzdem an – wir freuen uns auf dich!',
    duplicateTitle: 'Schon dabei!',
    duplicateSubtitle: 'Dieser Ausweis wurde bereits als Teilnehmer Nr. {n} erfasst.',
    duplicateHintWinner: 'Du hast bereits einen Hut gewonnen.',
    duplicateHintLoser: 'Jeder Ausweis kann nur einmal teilnehmen.',
    soldOutTitle: 'Primzahl – aber …',
    soldOutSubtitle: '… alle Hüte sind leider schon vergeben. Danke fürs Mitmachen!',
    errorTitle: 'Das hat nicht geklappt',
    errorSubtitle:
      'Der Server ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal oder sprich das Standpersonal an.',
    statsParticipants: 'Teilnehmer',
    statsWinners: 'Hüte gewonnen',
    statsLeft: 'Hüte übrig',
    idleHeadlines: [
      'Du willst einen roten Hut?',
      'Lass deinen Ausweis scannen!',
      'Mitmachen & gewinnen!',
      'Nur solange der Vorrat reicht!',
    ],
    idleCta: 'Sprich uns an – wir scannen deinen Ausweis',
    idleRuleCounter: 'Ist deine Teilnehmernummer eine Primzahl, gehört der Hut dir.',
    idleRuleCode: 'Ist deine Ausweisnummer eine Primzahl, gehört der Hut dir.',
    idleRuleRandom: 'Mit etwas Glück gehört einer unserer roten Hüte dir.',
  },
  en: {
    readyTitle: 'Get your badge scanned',
    readySubtitle: 'and with a little luck win an original red hat!',
    readyHint: 'Just talk to us – we will scan your badge',
    processing: 'One moment …',
    winTitle: 'Congratulations!',
    winSubtitle: 'You are participant #{n} – a prime number! Pick up your Red Hat at the booth.',
    loseTitle: 'Thanks for playing!',
    loseSubtitle: 'You are participant #{n}. Not a prime this time – no hat, sorry.',
    loseSubtitleCode: 'Your code is not a prime number – no hat this time.',
    winSubtitleCode: 'Your code is a prime number! Pick up your Red Hat at the booth.',
    winSubtitleRandom: 'You are participant #{n} and you won! Pick up your Red Hat at the booth.',
    loseSubtitleRandom: 'You are participant #{n}. Luck was not on your side this time.',
    loseTeaser: 'Come and talk to us anyway – we are happy to see you!',
    duplicateTitle: 'Already in!',
    duplicateSubtitle: 'This badge has already been registered as participant #{n}.',
    duplicateHintWinner: 'You have already won a hat.',
    duplicateHintLoser: 'Every badge can take part only once.',
    soldOutTitle: 'A prime – but …',
    soldOutSubtitle: '… all hats are gone already. Thanks for playing!',
    errorTitle: 'Something went wrong',
    errorSubtitle:
      'The server cannot be reached right now. Please try again or ask our booth staff.',
    statsParticipants: 'Participants',
    statsWinners: 'Hats won',
    statsLeft: 'Hats left',
    idleHeadlines: [
      'Want a red hat?',
      'Get your badge scanned!',
      'Join in & win!',
      'While stocks last!',
    ],
    idleCta: 'Talk to us – we scan your badge',
    idleRuleCounter: 'If your participant number is prime, the hat is yours.',
    idleRuleCode: 'If your badge number is prime, the hat is yours.',
    idleRuleRandom: 'With a bit of luck one of our red hats is yours.',
  },
} as const;

type TextKey = {
  [K in keyof (typeof TEXTS)['de']]: (typeof TEXTS)['de'][K] extends string ? K : never;
}[keyof (typeof TEXTS)['de']];

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);
  readonly texts = computed(() => TEXTS[this.settings.settings().language] ?? TEXTS.de);

  t(key: TextKey, params: Record<string, string | number> = {}): string {
    return (this.texts()[key] as string).replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ''));
  }
}
