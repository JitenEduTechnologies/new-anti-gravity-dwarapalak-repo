export default {
  // CallButton
  'Wählt…': 'Dialing…',
  Anrufen: 'Call',
  '{phone} im Browser anrufen': 'Call {phone} in browser',
  'Erst klingelt dein Telefon, dann wird {phone} verbunden':
    'Your phone rings first, then connects to {phone}',
  'Dein Telefon klingelt gleich – nimm ab, dann wird verbunden.':
    'Your phone will ring shortly – pick up to connect.',

  // Statuses
  'wird aufgebaut': 'initiating',
  klingelt: 'ringing',
  läuft: 'in progress',
  angenommen: 'answered',
  verpasst: 'missed',
  Voicemail: 'Voicemail',
  besetzt: 'busy',
  'nicht erreicht': 'no answer',
  fehlgeschlagen: 'failed',
  abgebrochen: 'canceled',

  // Tabs & Nav
  Anrufliste: 'Call log',
  'Power-Dialer': 'Power Dialer',
  Gespräche: 'Conversations',
  Leitfäden: 'Call Scripts',
  Telefonmenü: 'IVR Menu',
  Nummern: 'Numbers',
  Alle: 'All',
  Verpasst: 'Missed',
  Ausgehend: 'Outbound',

  // Main Page
  Anrufe: 'Calls',
  'Ein- und ausgehende Anrufe über Twilio – verpasste Anrufe, Telefonmenüs, Nummern, Power-Dialer und Gesprächsauswertung':
    'Inbound and outbound calls via Twilio – missed call recovery, IVR menus, number tracking, power dialer, and conversation analytics',
  Einstellungen: 'Settings',

  // Setup Notice
  'Telefonie ist noch nicht eingerichtet.': 'Telephony is not yet configured.',
  'Es fehlt: {missing}.': 'Missing: {missing}.',
  'Jetzt einrichten': 'Configure now',
  'Bitte die Agentur fragen.': 'Please contact your administrator.',

  // Stats
  'Anrufe ({days} Tage)': 'Calls ({days} days)',
  '{inbound} eingehend · {outbound} ausgehend':
    '{inbound} inbound · {outbound} outbound',
  'davon {count} mit Voicemail': '{count} with voicemail',
  Angenommen: 'Answered',
  '{pct} % aller Anrufe': '{pct}% of all calls',
  Gesprächszeit: 'Talk time',

  // Table
  'Nummer, Name, Transkription…': 'Number, name, transcript…',
  Kontakt: 'Contact',
  Status: 'Status',
  Dauer: 'Duration',
  Wann: 'When',
  'Voicemail / Aufnahme': 'Voicemail / Recording',
  eingehend: 'inbound',
  ausgehend: 'outbound',
  Unbekannt: 'Unknown',
  'Nummer unterdrückt': 'Caller ID hidden',
  KI: 'AI',
  'außerhalb der Zeiten': 'outside business hours',
  Zurückrufen: 'Call back',
  'Aufnahme löschen (auch bei Twilio)': 'Delete recording (including from Twilio)',
  'Aufnahme löschen': 'Delete recording',
  'Aufnahme endgültig löschen – auch bei Twilio?':
    'Permanently delete recording – including from Twilio?',
  'Aufnahme gelöscht': 'Recording deleted',
  'Noch keine Anrufe. Anrufe auf deine Twilio-Nummer und Klicks auf „Anrufen“ beim Kontakt landen hier.':
    'No calls yet. Inbound calls to your Twilio number and click-to-call events will appear here.',
  'Keine Anrufe in dieser Ansicht.': 'No calls in this view.',

  // CallsDialer: KIND_LABEL
  'später nochmal versuchen': 'retry later',
  'Rückruf vereinbart': 'callback scheduled',
  abgeschlossen: 'completed',

  // SettingsDialog
  'Anrufzeiten und Regeln': 'Calling Hours & Rules',
  Gespeichert: 'Saved',
  'Der Power-Dialer ruft nur an, wenn alle diese Regeln erfüllt sind. Die Prüfung läuft auf dem Server – auch ein direkter Klick auf „Anrufen“ umgeht sie nicht. Zeitzone: {tz}.':
    'The power dialer only places calls when all these criteria are met. Verification occurs on the server – direct click-to-call events also adhere to these rules. Timezone: {tz}.',
  Anrufzeiten: 'Calling hours',
  Mo: 'Mon',
  Di: 'Tue',
  Mi: 'Wed',
  Do: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  So: 'Sun',
  von: 'from',
  bis: 'to',
  'An gesetzlichen Feiertagen nicht anrufen': 'Do not call on statutory holidays',
  Bundesland: 'State / Region',
  'nur bundesweite Feiertage': 'national holidays only',
  Einwilligung: 'Consent',
  'Wer darf angerufen werden?': 'Who is eligible to be called?',
  'Das Einwilligungs-Modul ist aktiv.': 'Consent management module is active.',
  'Das Einwilligungs-Modul ist nicht aktiv: nur „Nicht stören“ zählt.':
    'Consent management module is inactive: only DND status is enforced.',
  'Nach der Einwilligungs-Regel des Projekts (Ledger)':
    'According to project consent ledger policy',
  'Streng: nur mit bestätigter Telefon-Einwilligung':
    'Strict: verified phone marketing consent only',
  Versuche: 'Attempts',
  'Höchstens … Versuche je Kontakt': 'Maximum attempts per contact',
  'Pause bis zum nächsten Versuch (Minuten)':
    'Retry cooldown interval (minutes)',
  'Pause nach einem Gespräch (Sekunden)':
    'Post-call wrap-up pause (seconds)',
  'Zeit für Notizen, bevor der nächste Kontakt kommt.':
    'Wrap-up time for notes before the next contact is queued.',
  'Ergebnisse (Gesprächsausgang)': 'Call outcomes (dispositions)',
  'Bezeichnung {key}': 'Label {key}',
  Erfolg: 'Success',
  'Nicht mehr anrufen': 'Do not call again (DND)',
  '„Nicht mehr anrufen“ widerruft die Telefon-Einwilligung des Kontakts und stoppt alle offenen Einträge. Mindestens ein Ergebnis muss das bedeuten.':
    '“Do not call again” revokes contact phone consent and closes pending attempts. At least one disposition must enforce this.',

  // ListDialog
  '{total} Kontakte in der Liste{noPhone}':
    '{total} contacts in call list{noPhone}',
  ' ({count} ohne Telefonnummer ausgelassen)':
    ' ({count} skipped without phone number)',
  'Neue Anrufliste': 'New call list',
  'Liste anlegen': 'Create list',
  Name: 'Name',
  'z. B. Webinar-Teilnehmer nachfassen':
    'e.g. Follow up webinar participants',
  'Woher kommen die Kontakte?': 'Contact source',
  'Aus einer Smart List': 'From a smart list',
  'Aus einem Tag': 'From a tag',
  'Smart List': 'Smart List',
  'Nur Kontakte mit Telefonnummer kommen in die Liste. Kontakte, die nicht angerufen werden dürfen, werden beim Durchgehen markiert.':
    'Only contacts with phone numbers are queued. Restricted contacts will be flagged during processing.',
  '— bitte wählen —': '— please select —',
  Tag: 'Tag',
  'Nachricht für die Mailbox (optional)': 'Voicemail drop audio (optional)',
  'Eine Aufnahme, die der Dialer bei einem Anrufbeantworter abspielt. Unter Telefonmenü → Audio als „Voicemail-Drop“ anlegen.':
    'Pre-recorded message played when reaching an answering machine. Configure under IVR Menu → Audio as "Voicemail drop".',
  keine: 'none',
  'Notiz zur Liste (optional)': 'List notes (optional)',

  // Session
  'Nachricht wird abgespielt – der Anruf endet danach.':
    'Message is playing – the call will terminate afterwards.',
  '← Alle Listen': '← All lists',
  'Anrufzeit läuft': 'Calling window open',
  'Automatisch weiter': 'Auto-advance',
  Offen: 'Pending',
  Rückrufe: 'Callbacks',
  Erledigt: 'Completed',
  'von {total}': 'of {total}',
  Gesperrt: 'Blocked',
  'Nicht stören oder keine Einwilligung': 'DND or missing consent',
  'Aktueller Kontakt': 'Current contact',
  'Versuch {attempt} von {max}{callback}':
    'Attempt {attempt} of {max}{callback}',
  ' · Rückruf fällig {date}': ' · callback due {date}',
  Überspringen: 'Skip',
  'Kontakt öffnen': 'Open contact',
  'Mailbox: Nachricht abspielen': 'Voicemail: Drop message',
  'Spielt deine aufgenommene Nachricht ab und legt dann auf':
    'Plays pre-recorded message and disconnects immediately',
  'Letzte Notizen': 'Recent notes',
  'Frühere Anrufe: ': 'Previous calls: ',
  Ergebnis: 'Outcome',
  'Wie ist das Gespräch ausgegangen? Das Ergebnis beendet den Versuch und holt den nächsten Kontakt.':
    'Select call disposition. Logging an outcome finalizes this attempt and queues the next contact.',
  'Notiz (landet beim Kontakt)': 'Note (saved to contact timeline)',
  'Rückruf am (nur bei „Rückruf vereinbart“)':
    'Callback time (only for "callback scheduled")',
  'Rückruf übernimmt': 'Assigned agent',
  ich: 'me',
  'Bitte Datum und Uhrzeit des Rückrufs wählen.':
    'Please select date and time for callback.',
  '{name} wird nicht mehr angerufen (Einwilligung wird widerrufen). Fortfahren?':
    '{name} will not be called again (consent will be revoked). Proceed?',
  'Gespeichert: {label}': 'Saved: {label}',
  Fertig: 'Finished',
  'Gerade nicht möglich': 'Currently unavailable',
  'Kein Kontakt': 'No contact',
  'Nächster Kontakt in {wait} Sekunden …':
    'Next contact in {wait} seconds …',
  'Das Ergebnis ist gespeichert.': 'Outcome recorded.',
  'Weiter geht es ab {date}.': 'Resuming on {date}.',
  'Jetzt weiter': 'Next now',
  'Erneut versuchen': 'Retry',
  'Pause machen': 'Take a pause',

  // CallsDialer Main
  '{answered} erreicht': '{answered} connected',
  Erfolge: 'Successes',
  Anruflisten: 'Call lists',
  'Ein Kontakt nach dem anderen: Anrufen, Ergebnis eintragen, nächster. Wer nicht angerufen werden darf, wird automatisch übersprungen.':
    'Sequential power dialing: call, log disposition, advance. Non-callable contacts are automatically bypassed.',
  'Zeiten und Regeln': 'Hours & Rules',
  'Neue Liste': 'New list',
  pausiert: 'paused',
  '{count} Rückruf{plural}': '{count} callback{plural}',
  '{count} gesperrt': '{count} blocked',
  'Liste fortsetzen': 'Resume list',
  'Liste pausieren': 'Pause list',
  Fortsetzen: 'Resume',
  Pausieren: 'Pause',
  'Kontakte neu einlesen': 'Sync contacts',
  'Neue Kontakte aus der Quelle einlesen und Gesperrte prüfen':
    'Import new contacts from source and re-evaluate compliance filters',
  '{added} neu, {released} wieder freigegeben':
    '{added} new, {released} restored',
  '{name} löschen': 'Delete {name}',
  'Liste „{name}“ löschen? Offene Rückruf-Aufgaben gehen mit.':
    'Delete list “{name}”? Pending callback tasks will be deleted.',
  Gelöscht: 'Deleted',
  'Smart List „{name}“': 'Smart List “{name}”',
  'Tag {tags}': 'Tag {tags}',
  '{pending} offen · {done}/{total} erledigt':
    '{pending} pending · {done}/{total} completed',
  'Noch keine Anrufliste. Lege eine aus einer Smart List oder einem Tag an.':
    'No call lists yet. Create one from a smart list or a tag.',
  'Meine Rückrufe': 'My Callbacks',
  'Vereinbarte Rückrufe, die dir gehören oder niemandem zugeteilt sind.':
    'Scheduled callbacks assigned to you or unassigned.',
  fällig: 'due',
  'Keine offenen Rückrufe.': 'No pending callbacks.',
  'Der Power-Dialer hält sich an „Nicht stören“, die Einwilligung des Kontakts, deine Anrufzeiten und die Feiertage. Werbeanrufe bei Verbrauchern sind in Deutschland nur mit vorheriger ausdrücklicher Einwilligung erlaubt, bei Unternehmen mindestens mit mutmaßlicher Einwilligung (§ 7 UWG). Prüfe deine Listen entsprechend – das ist keine Rechtsberatung.':
    'The power dialer enforces DND flags, marketing consent, calling hours, and statutory holidays. Verify compliance with telecom marketing regulations (e.g. TRAI / DNC). This does not constitute legal advice.',

  // CallsIntel: Constants
  Anruf: 'Call',
  Aufnahme: 'Recording',
  Transkript: 'Transcript',
  wartet: 'queued',
  'wird transkribiert …': 'transcribing …',
  'wird ausgewertet …': 'analyzing …',
  positiv: 'positive',
  negativ: 'negative',
  neutral: 'neutral',
  gemischt: 'mixed',
  Mitarbeiter: 'Agent',
  Gegenüber: 'Customer / Counterpart',

  // SettingsDialog
  'Einstellungen der Gesprächsauswertung': 'Conversation Intelligence Settings',
  'Für die Transkription fehlt eine Sprach-Verbindung (Einstellungen → KI-Verbindungen, Art „Sprache zu Text“).':
    'A speech-to-text connection is required for transcription (Settings → AI Connections, type "Speech to Text").',
  'Für Zusammenfassung und Aufgaben fehlt der KI-Assistent: {problem} Ohne ihn zählt die Auswertung nur Redeanteile, Füllwörter und Stichwörter.':
    'AI Assistant is unavailable for summaries and tasks: {problem} Without it, only talk ratios, filler words, and keywords are computed.',
  'Jedes aufgezeichnete Gespräch automatisch auswerten':
    'Automatically analyze every recorded conversation',
  'Dafür wird die Aufnahme an deinen Sprachanbieter gesendet. Schalte das nur ein, wenn die Aufzeichnung rechtmäßig ist (Hinweis am Telefon, Einwilligung) und der Anbieter in deiner Datenschutzerklärung und im Auftragsverarbeitungsvertrag steht. Einzelne Gespräche kannst du auch von Hand auswerten.':
    'Audio recordings are transmitted to your speech provider. Enable only when recordings are compliant (statutory disclosure/consent) and provider is listed in data privacy policy / DPA. Individual calls can also be analyzed manually.',
  'Kürzere Aufnahmen auslassen (Sekunden)':
    'Skip shorter recordings (seconds)',
  'Sprache der Gespräche': 'Conversation language',
  'Aufbewahrung der Auswertungen (Tage, 0 = unbegrenzt)':
    'Retention of intelligence data (days, 0 = indefinite)',
  Sprachanbieter: 'Speech provider',
  Standard: 'Default',
  'KI fasst zusammen und findet Aufgaben, Themen und Einwände':
    'AI summarizes conversation and extracts action items, topics, and objections',
  'Zusammenfassung in den Verlauf des Kontakts schreiben':
    'Post summary to contact timeline',
  'Aufgaben der eigenen Seite sofort als Aufgabe anlegen':
    'Automatically create tasks for own action items',
  'Mitarbeiter und Gegenüber vertauschen (falls die Zuordnung der Tonspuren bei dir umgekehrt ist)':
    'Swap agent and customer audio channels (if stereo tracks are reversed)',
  'Standard-Scorecard': 'Default scorecard',
  'Wird nach jeder Auswertung automatisch von der KI vorbewertet.':
    'Automatically pre-scored by AI after analysis.',
  'Eigene Füllwörter': 'Custom filler words',
  'Kommen zur eingebauten Liste (äh, ähm, also, quasi …) dazu.':
    'Added to default dictionary of hesitation words.',
  'Wort + Enter': 'Word + Enter',
  'Namen und Fachbegriffe': 'Glossary & custom terminology',
  'Hilft der Spracherkennung, z. B. Produktnamen richtig zu schreiben.':
    'Assists speech recognition with specialized vocabulary and product names.',

  // UploadDialog
  'Bitte eine Audiodatei wählen.': 'Please select an audio file.',
  'Wird ausgewertet …': 'Analyzing …',
  'Gespräch auswerten': 'Analyze conversation',
  'Wird hochgeladen …': 'Uploading …',
  Auswerten: 'Analyze',
  'Was hast du?': 'Upload format',
  'Eine Aufnahme (MP3, WAV, M4A, WebM …)':
    'Audio recording (MP3, WAV, M4A, WebM …)',
  'Ein fertiges Transkript (Teams, Zoom, Meet)':
    'Existing transcript (Teams, Zoom, Google Meet)',
  'Titel (optional)': 'Title (optional)',
  'z. B. Erstgespräch Müller GmbH': 'e.g. Discovery call Acme Corp',
  'Mit einer Tonspur je Gesprächspartner (z. B. aus einer Konferenz-Aufzeichnung) lässt sich auch der Redeanteil messen.':
    'Multi-channel stereo audio allows measuring individual speaker talk ratios.',
  'Alle Beteiligten wurden über die Aufzeichnung informiert und haben zugestimmt (§ 201 StGB, DSGVO).':
    'All participants have been notified and consented to call recording.',
  'Die Aufnahme geht zur Transkription an deinen Sprachanbieter und wird danach gelöscht; behalten wird das Transkript.':
    'Audio is sent to speech provider for transcription and purged afterwards; transcript is retained.',
  'Sprecher: Text …': 'Speaker: message …',

  // Detail
  Gespräch: 'Conversation',
  'Aufgabe angelegt': 'Task created',
  'je Sprecher getrennt': 'separate channels per speaker',
  'Die Auswertung ist fehlgeschlagen.': 'Analysis failed.',
  'Neuer Versuch gestartet': 'New attempt initiated',
  'Nochmal versuchen': 'Retry',
  'Die KI konnte nicht zusammenfassen ({error}). Redeanteile, Füllwörter und Stichwörter sind trotzdem gezählt. ':
    'AI summary failed ({error}). Talk ratios, filler words, and keywords were still extracted. ',
  Zusammenfassung: 'Summary',
  'Keine Zusammenfassung (die KI war nicht erreichbar).':
    'No summary available (AI service unreachable).',
  'Nächster Schritt:': 'Next step:',
  Einwände: 'Objections',
  Zahlen: 'Metrics',
  'Redeanteil Mitarbeiter {pct} Prozent': 'Agent talk ratio {pct} percent',
  'Längster Monolog': 'Longest monologue',
  Redewechsel: 'Turn changes',
  'Der Redeanteil lässt sich nur messen, wenn die Aufnahme eine Tonspur je Gesprächspartner hat (Anrufe mit Aufzeichnung haben sie).':
    'Talk ratio can only be calculated with separate speaker tracks (present on stereo call recordings).',
  Wörter: 'Words',
  Fragen: 'Questions',
  'Füllwörter je 100 Wörter': 'Filler words per 100 words',
  'Mitarbeiter {val}': 'Agent {val}',
  'Wörter pro Minute': 'Words per minute (WPM)',
  'Gegenüber {val}': 'Customer {val}',
  'Stimmung: {overall}': 'Sentiment: {overall}',
  ' · Gegenüber {sentiment}': ' · Customer {sentiment}',
  ' · Mitarbeiter {sentiment}': ' · Agent {sentiment}',
  'Aufgaben aus dem Gespräch': 'Action items from conversation',
  wir: 'us',
  andere: 'others',
  ' · bis {date}': ' · due {date}',
  'als Aufgabe angelegt': 'created as task',
  'Aufgabe anlegen': 'Create task',
  'Keine Aufgaben erkannt.': 'No action items identified.',
  'Bewertung (Scorecard)': 'Scorecard evaluation',
  'Die KI schlägt je Kriterium eine Note vor, eine Führungskraft prüft.':
    'AI suggests rating per criterion; reviewer verifies.',
  'Kein Transkript.': 'No transcript.',
  'Zur Anrufliste': 'Go to call log',
  'Auswertung mit Transkript löschen?':
    'Delete analysis and transcript?',

  // CallsIntel Main
  'Für die Transkription fehlt eine Sprach-Verbindung. Trage bei den KI-Verbindungen einen Sprachanbieter ein (Art „Sprache zu Text“), dann lassen sich Anrufe und Aufnahmen auswerten.':
    'A speech-to-text connection is required. Configure a speech provider under AI Connections to analyze calls and recordings.',
  'Ausgewertet (30 Tage)': 'Analyzed (30 days)',
  '{count} laufen': '{count} running',
  '{count} fehlgeschlagen': '{count} failed',
  'Redeanteil Mitarbeiter': 'Agent talk ratio',
  'Richtwert: unter 50 %': 'Benchmark: under 50%',
  Stimmung: 'Sentiment',
  'Suchen in Titel, Zusammenfassung, Transkript …':
    'Search titles, summaries, transcripts …',
  'Jede Stimmung': 'All sentiments',
  'Jede Quelle': 'All sources',
  'Aufnahme oder Transkript': 'Upload recording or transcript',
  Scorecards: 'Scorecards',
  Telefonat: 'Phone call',
  'Redeanteil Mitarbeiter {pct}': 'Agent talk ratio {pct}',
  'Noch nichts ausgewertet. Aufgezeichnete Anrufe wertest du in der Anrufliste per ✨ aus, Meeting-Aufnahmen und Transkripte lädst du oben hoch.':
    'No conversations analyzed yet. Analyze recorded calls from the call log via ✨, or upload meeting recordings and transcripts above.',
  'Pro Person (30 Tage)': 'Per agent breakdown (30 days)',
  'Zum Coaching, nicht zum Ranking: Redeanteil, Füllwörter, Stimmung und Scorecard-Durchschnitt.':
    'For coaching, not ranking: talk ratio, filler words, sentiment, and average scorecard marks.',
  Person: 'Person',
  Redeanteil: 'Talk ratio',
  'Füllwörter / 100': 'Fillers / 100',
  Scorecard: 'Scorecard',

  // CallsNumbers
  Hauptnummer: 'Main number',
  'Tracking-Nummer': 'Tracking number',
  'Pool-Nummer': 'Pool number',
  Ortsnummer: 'Local number',
  Mobilnummer: 'Mobile number',
  Gebührenfrei: 'Toll-free',
  'Nummer {num}': 'Number {num}',
  Bezeichnung: 'Label',
  'Zum Beispiel „Hauptnummer“ oder „Google-Anzeigen Herbst“.':
    'For example "Main number" or "Google Ads Fall".',
  Art: 'Type',
  'Eine Tracking-Nummer gehört fest zu einer Kampagne (Flyer, Anzeige). Pool-Nummern wechselt die Website je Besucher.':
    'A tracking number is dedicated to one campaign (flyer, ad). Pool numbers are dynamically assigned by website per visitor.',
  Quelle: 'Source',
  'z. B. google': 'e.g. google',
  Medium: 'Medium',
  'z. B. cpc, flyer': 'e.g. cpc, flyer',
  Kampagne: 'Campaign',
  'z. B. herbst-aktion': 'e.g. fall-promotion',
  Pool: 'Pool',
  'Wohin führt ein Anruf auf diese Nummer?':
    'Where should calls to this number be routed?',
  '— Telefonmenü wählen —': '— Select IVR menu —',
  '— Gruppe wählen —': '— Select group —',
  '— Person wählen —': '— Select user —',
  'Name des Postfachs, z. B. Vertrieb': 'Mailbox name, e.g. Sales',
  'Der normale Ablauf: Weiterleitung an dein Handy und die Browser-Telefone zu den Geschäftszeiten, sonst KI-Telefonagent oder Voicemail.':
    'Default flow: forward to mobile and browser phones during business hours, otherwise AI voice assistant or voicemail.',
  'Klingelt im Browser-Telefon dieser Person. Ist es nicht geöffnet, greift der normale Ablauf.':
    'Rings in this person’s browser phone. If unavailable, falls back to default routing flow.',
  'Nummer gekauft': 'Number purchased',
  'Nummer kaufen': 'Buy number',
  'Die Nummer wird über dein Twilio-Konto gekauft und kostet dort eine monatliche Gebühr. Es wird nichts gekauft, bevor du unten ausdrücklich bestätigst.':
    'Numbers are purchased directly through your Twilio account and billed monthly. No charges occur until you explicitly confirm below.',
  Land: 'Country',
  'Zwei Buchstaben, z. B. DE, AT, CH': 'Two letters, e.g. DE, US, IN',
  Vorwahl: 'Area code',
  'z. B. 30 für Berlin': 'e.g. 30 for Berlin',
  'Enthält Ziffern': 'Contains digits',
  'Wunschziffern, z. B. 777': 'Desired digits, e.g. 777',
  'Nummern suchen': 'Search numbers',
  'Verfügbare Nummern': 'Available numbers',
  Sprache: 'Voice',
  SMS: 'SMS',
  Beta: 'Beta',
  '/Monat': '/month',
  'Keine Nummern mit diesen Angaben. Lass die Vorwahl oder die Wunschziffern weg.':
    'No numbers match these criteria. Try omitting the area code or digit pattern.',
  '{num} einrichten': 'Configure {num}',
  Adresse: 'Address',
  'In diesem Twilio-Konto gibt es noch keine Adresse für dieses Land.':
    'No address on file in this Twilio account for this country.',
  'Die Adresse, die Twilio für diese Nummer nachweist.':
    'The verified address Twilio provides for this phone number.',
  '— keine —': '— none —',
  ' (nicht bestätigt)': ' (unverified)',
  'Regulatory Bundle': 'Regulatory Bundle',
  'Nur genehmigte Bundles können Nummern kaufen.':
    'Only approved regulatory bundles can be used to acquire phone numbers.',
  'Es gibt noch kein genehmigtes Bundle – die Prüfung durch Twilio dauert meist einige Werktage.':
    'No approved bundle exists yet — Twilio regulatory review typically takes several business days.',
  '— keins —': '— none —',
  genehmigt: 'approved',
  'Dafür fehlt noch etwas in Twilio:':
    'Required prerequisites missing in Twilio:',
  'eine Adresse im Land {country}': 'an address registered in country {country}',
  'ein genehmigtes Regulatory Bundle': 'an approved regulatory bundle',
  'Lege beides in der Twilio-Konsole an: ':
    'Configure both in the Twilio Console: ',
  Adressen: 'Addresses',
  'Regulatory Bundles': 'Regulatory Bundles',
  '. Danach diesen Dialog neu öffnen.': '. Then reopen this dialog.',
  'z. B. Hauptnummer': 'e.g. Main Number',
  Verwendung: 'Usage',
  google: 'google',
  cpc: 'cpc',
  'herbst-aktion': 'fall-promotion',
  'Ich kaufe {num} bei Twilio{cost}.': 'I am purchasing {num} via Twilio{cost}.',
  ' für {price} im Monat': ' for {price} per month',
  ' (monatliche Gebühr laut Twilio-Preisliste)':
    ' (monthly recurring charge per Twilio pricing)',
  'Pool: {name}': 'Pool: {name}',
  'Neuer Nummern-Pool': 'New number pool',
  'Ein Pool tauscht auf deiner Website die Telefonnummer je nach Herkunft des Besuchers. Ruft jemand an, wird der Anruf der Kampagne zugeordnet. Mit mehr Nummern im Pool können mehr Besucher gleichzeitig eine eigene Nummer sehen.':
    'A dynamic pool swaps phone numbers on your website depending on visitor source. Incoming calls are attributed to specific campaigns. Adding more numbers allows more concurrent visitors to receive unique tracking numbers.',
  'z. B. Website': 'e.g. Website',
  'Nummer, wie sie auf der Website steht':
    'Number as written on the website',
  'Genau so geschrieben wie im Text der Seite – sie wird ersetzt.':
    'Written exactly as displayed on page text — it will be dynamically replaced.',
  '030 123456': '030 123456',
  Ersatznummer: 'Fallback number',
  'Wenn kein Pool-Platz frei ist (Anrufe darauf zählen als „ohne Quelle“).':
    'Used when all pool numbers are active (calls are logged as "no source").',
  optional: 'optional',
  'Nur für diese Quellen tauschen': 'Only swap for these traffic sources',
  'Leer = für alle Besucher mit Kampagnen- oder Suchmaschinen-Herkunft. Beispiele: google/cpc, facebook, newsletter.':
    'Blank = apply to all visitors from campaigns or search engines. Examples: google/cpc, facebook, newsletter.',
  'Quelle + Enter': 'Source + Enter',
  'Besuch zählt (Minuten)': 'Session duration (minutes)',
  'So lange gehört eine Nummer einem Besucher.':
    'Duration a phone number remains reserved for an active visitor session.',
  'Anruf danach noch zuordnen (Minuten)':
    'Post-session attribution window (minutes)',
  'Wer die Seite verlässt und dann anruft.':
    'Attribution window for callers who dial after navigating away from the website.',
  'Wenn alle Nummern vergeben sind': 'When pool capacity is exhausted',
  'Ersatznummer zeigen': 'Display fallback number',
  'Älteste Nummer mitbenutzen': 'Re-use oldest assigned number',
  'Nur im Bereich (CSS-Selektor, optional)':
    'Scope to CSS selector (optional)',
  'Zum Beispiel header oder .kontakt – leer: die ganze Seite.':
    'For example header or .contact — leave blank for whole document.',
  'Auf Funnel- und Landingpages dieses Projekts automatisch einbauen':
    'Automatically inject on funnel and landing pages in this workspace',
  'Pool ist eingeschaltet': 'Number pool is active',
  'Nummern im Pool': 'Numbers in pool',
  'Noch keine Nummer. Kaufe zuerst Nummern (Art „Pool-Nummer“).':
    'No numbers available. Purchase phone numbers with type "Pool number" first.',
  'Pools für die Website': 'Dynamic number pools for websites',
  'Die Website zeigt jedem Besucher je nach Herkunft eine eigene Nummer. Anrufe werden so Kampagne, Anzeige oder Suchbegriff zugeordnet.':
    'Your website shows each visitor a unique phone number based on acquisition channel. Inbound calls are credited to specific campaigns, ads, or search terms.',
  'Neuer Pool': 'New pool',
  aus: 'off',
  '{count} Nummer{plural}': '{count} number{plural}',
  'Pool „{name}“ löschen? Die Nummern bleiben als Tracking-Nummern erhalten.':
    'Delete pool “{name}”? Its numbers will be preserved as tracking numbers.',
  'Ersetzt „{default}“ · {sessions} Besuche aktiv · {calls} Anrufe (30 Tage)':
    'Replaces “{default}” · {sessions} active sessions · {calls} calls (30 days)',
  'Noch kein Pool. Lege einen an, kaufe Pool-Nummern und baue das Snippet in deine Website ein.':
    'No number pools configured yet. Create a pool, purchase pool numbers, and embed the script snippet on your site.',
  'Das Snippet kommt in den <head> deiner Website. Auf Funnels und Landingpages dieses Projekts wird es automatisch eingebaut, wenn du das oben nicht abschaltest. Besucher ohne Kampagnenherkunft sehen weiter die normale Nummer.':
    'Place this snippet inside your website <head>. On funnel and landing pages in this project it is injected automatically unless disabled above. Direct/organic visitors continue seeing the default number.',
  'Anrufe nach Quelle': 'Calls by source',
  '{from} bis {to}': '{from} to {to}',
  'Letzte 30 Tage': 'Last 30 days',
  Nummer: 'Number',
  '{answered} angenommen · {missed} verpasst':
    '{answered} answered · {missed} missed',
  'Besuche mit eigener Nummer': 'Unique tracked visitor sessions',
  'Quelle / Medium / Kampagne': 'Source / Medium / Campaign',
  'Ø Dauer': 'Avg. duration',
  Anrufer: 'Callers',
  'Noch keine Anrufe mit bekannter Herkunft. Sie erscheinen, sobald jemand eine Tracking- oder Pool-Nummer anruft.':
    'No source-attributed calls recorded yet. They will appear as soon as a tracking or pool number is dialed.',
  'Nummern verwalten die Agentur oder Mitglieder mit Zugriff auf die Einstellungen.':
    'Phone numbers are managed by agency administrators or users with settings access.',
  '{num} an Twilio zurückgeben? Die Nummer lässt sich danach nicht zurückholen.':
    'Release {num} back to Twilio? This action is irreversible.',
  'Nummer freigegeben': 'Number released',
  'Die Telefonie ist noch nicht eingerichtet. Trage zuerst Account SID und Auth Token ein (Einstellungen → Telefonie), dann kannst du Nummern kaufen und zuordnen.':
    'Telephony is not configured yet. Set up Twilio Account SID and Auth Token under Settings → Telephony before purchasing or assigning numbers.',
  Rufnummern: 'Phone Numbers',
  'Jede Nummer führt in ein Telefonmenü, zu einer Gruppe, einer Person oder ans Handy – oder in den normalen Ablauf.':
    'Route inbound calls to an IVR menu, ring group, agent, mobile number, or standard business-hours flow.',
  '{count} Anrufe / 30 Tage': '{count} calls / 30 days',
  '{num} freigeben': 'Release {num}',
  'An Twilio zurückgeben': 'Release back to Twilio',
  'Normaler Ablauf': 'Default routing flow',
  ' · Kampagne {campaign}': ' · Campaign {campaign}',
  'Noch keine Nummer. Trage deine Twilio-Nummern in den Telefonie-Einstellungen ein oder kaufe hier eine.':
    'No phone numbers configured yet. Register existing Twilio numbers in Telephony Settings or buy one here.',
  'Zurückgegeben: {numbers}': 'Released numbers: {numbers}',

  // CallsFlows
  'keine Eingabe': 'no input',
  'falsche Taste': 'invalid key',
  geöffnet: 'open',
  geschlossen: 'closed',
  Feiertag: 'holiday',
  danach: 'then',
  'niemand erreichbar': 'no one available',
  'Aufgenommene Ansage': 'Recorded greeting',
  'Zeitplan (gelöscht)': 'Schedule (deleted)',
  'Öffnungszeiten aus den Telefonie-Einstellungen':
    'Business hours from Telephony Settings',
  'Noch kein Ziel': 'No destination configured',
  'Noch keine Gruppe gewählt': 'No group selected',
  'Postfach „{name}“': 'Mailbox “{name}”',
  'Nimmt das Gespräch an, wenn der KI-Telefonagent eingerichtet ist':
    'Answers call if AI Voice Assistant is configured',
  'Beendet den Anruf': 'Ends call',
  Start: 'Start',
  Menü: 'Menu',
  Zeitplan: 'Schedule',
  Ansage: 'Announcement',
  Weiterleiten: 'Forward',
  'Gruppe / Warteschlange': 'Group / Queue',
  'KI-Telefonagent': 'AI Voice Assistant',
  Auflegen: 'Hang up',
  'weiter bei „{label}“': 'continue at “{label}”',
  'Nicht angeschlossene Schritte (kein anderer Schritt führt hierher):':
    'Unconnected steps (no preceding step routes here):',
  'Weiter bei': 'Route to',
  '— nichts (normaler Ablauf) —': '— none (default flow) —',
  'Neuer Schritt': 'New step',
  'Text vorlesen lassen': 'Generate text-to-speech',
  '„{name}“ löschen? Verweise darauf werden entfernt.':
    'Delete “{name}”? Incoming links to this step will be cleared.',
  Übernehmen: 'Apply',
  'Als Start festlegen': 'Set as starting step',
  'Schritt löschen': 'Delete step',
  'Name des Schritts': 'Step name',
  'Steht im Anrufprotokoll („Hauptmenü › Taste 2 Support“).':
    'Recorded in call logs (e.g. "Main Menu > Key 2 Support").',
  'Wird mit deutscher Stimme vorgelesen – oder lade unter „Audio“ eine eigene Aufnahme hoch.':
    'Read with text-to-speech engine — or upload custom recording under "Audio".',
  'Willkommen bei …': 'Welcome to …',
  'oder eigene Aufnahme': 'or custom audio file',
  Tasten: 'Keys',
  'Wofür? (nur zur Übersicht)': 'Purpose (internal note)',
  'Beschriftung Taste {key}': 'Key label {key}',
  'Taste {key} entfernen': 'Remove key {key}',
  '＋ Taste hinzufügen': '＋ Add key',
  'Wenn nichts gedrückt wird (nach den Wiederholungen)':
    'When timeout expires (after retries)',
  'Wenn eine nicht belegte Taste gedrückt wird':
    'When an unmapped key is pressed',
  Wiederholungen: 'Retries',
  'Sekunden auf eine Taste warten': 'Seconds to wait for keypress',
  'Öffnungszeiten, Feiertage und Sonderzeiten legst du im Reiter „Zeitpläne“ an.':
    'Configure opening hours, holidays, and exceptions under "Schedules".',
  'Wenn geöffnet': 'When open',
  'Wenn geschlossen': 'When closed',
  'An Feiertagen (leer: wie geschlossen)':
    'On statutory holidays (blank: same as closed)',
  'Danach weiter bei': 'Then continue at',
  'Ansage vor dem Weiterleiten (optional)':
    'Announcement before forwarding (optional)',
  'Mehrere mit Komma trennen – alle klingeln gleichzeitig. Format +49…':
    'Comma separated — all ring simultaneously. Format +49…',
  'Personen (Browser-Telefon)': 'Agents (browser phone)',
  'Klingeldauer (Sekunden)': 'Ring duration (seconds)',
  'Wenn niemand abnimmt': 'When no one answers',
  'Ruf-Gruppe oder Warteschlange': 'Ring group or queue',
  'Mitglieder, Verteilung, Wartemusik und Überlauf stellst du im Reiter „Gruppen“ ein.':
    'Configure members, strategy, hold music, and overflow under "Groups".',
  'Wenn niemand erreichbar ist': 'When no one is available',
  'Name des Postfachs': 'Mailbox name',
  'Erscheint im Anrufprotokoll und in der Benachrichtigung („Vertrieb“).':
    'Appears in call log and notification (e.g. "Sales").',
  'Ansage vor dem Signalton': 'Greeting before tone',
  'Leer: die Standardansage.': 'Blank: default greeting.',
  'Rückruf-Aufgabe für': 'Callback task assigned to',
  'Zu jeder Nachricht entsteht eine Aufgabe für diese Person.':
    'Creates an action task assigned to this team member for every voicemail.',
  niemanden: 'nobody',
  'Der Anruf geht an den KI-Telefonagent (Einstellungen → KI-Telefonagent). Ist er nicht eingerichtet oder nicht erreichbar, geht es hier weiter:':
    'Calls route to the AI Voice Assistant (Settings → AI Voice Assistant). If unconfigured or unreachable, flow continues here:',
  'Wenn die KI nicht antworten kann': 'When AI is unable to answer',
  'Letzter Satz (optional)': 'Final sentence (optional)',
  'Vielen Dank für Ihren Anruf.': 'Thank you for calling.',
  'Das Menü wartet hier auf eine Taste.': 'The menu waits for a keypress here.',
  'Der normale Ablauf übernimmt (Weiterleitung, KI-Telefonagent oder Voicemail).':
    'Default routing takes over (call forwarding, AI Voice Assistant, or voicemail).',
  'Der Weg läuft im Kreis.': 'The routing path contains an infinite loop.',
  'Der Anruf wird weitergeleitet.': 'The call is forwarded.',
  'Der Anruf geht an die Ruf-Gruppe oder Warteschlange.':
    'The call is routed to the ring group or call queue.',
  'Der Anrufer spricht eine Voicemail auf.': 'The caller records a voicemail.',
  'Der KI-Telefonagent nimmt das Gespräch an.':
    'The AI Voice Assistant answers the call.',
  'Der Anruf wird beendet.': 'The call is terminated.',
  'Nach der Ansage ist der Anruf zu Ende.':
    'The call terminates after the announcement.',
  Testlauf: 'Dry run',
  'Geht den gespeicherten Ablauf durch, als würde jemand anrufen – es wird niemand angerufen.':
    'Simulates call progression step-by-step without making actual calls.',
  'Du hast ungespeicherte Änderungen. Der Testlauf nutzt den gespeicherten Stand.':
    'You have unsaved changes. The dry run simulates the saved version.',
  'Gedrückte Tasten': 'Simulated keypresses',
  'In der Reihenfolge, z. B. 12 – ein Unterstrich steht für „nichts gedrückt“.':
    'Sequence of digits, e.g. 12 — underscore "_" represents timeout / no key.',
  'z. B. 1': 'e.g. 1',
  'Zeitpunkt des Anrufs': 'Call timestamp',
  'Leer: jetzt. So prüfst du Feiertage und Abendstunden.':
    'Blank: current time. Test holiday routing and after-hours schedules.',
  Testen: 'Simulate',
  'Ergebnis:': 'Result:',
  '← Alle Menüs': '← All menus',
  'Ungespeicherte Änderungen verwerfen?': 'Discard unsaved changes?',
  'Name des Menüs': 'Menu title',
  'Das fällt auf:': 'Observations / Warnings:',
  'Dieses Menü ist noch keiner Nummer zugeordnet. Unter „Nummern“ legst du fest, welche Nummer in dieses Menü führt.':
    'This menu is not assigned to any phone number yet. Map inbound numbers under "Numbers".',
  Ablauf: 'Workflow tree',
  'Klicke einen Schritt, um ihn zu bearbeiten. Die Linien zeigen, wohin welche Taste oder Bedingung führt.':
    'Click a step to configure. Branch lines illustrate key presses and schedule routing.',
  '＋ Schritt hinzufügen': '＋ Add step',
  'Nummern in dieses Menü': 'Numbers routing to this menu',
  'Noch keine.': 'None yet.',
  Telefonmenüs: 'IVR Menus',
  'Ein Menü begrüßt Anrufer, lässt sie eine Taste drücken, prüft Öffnungszeiten und Feiertage und leitet an Personen, Gruppen, die KI oder die Voicemail weiter.':
    'IVR menus greet callers, gather DTMF key presses, evaluate schedules and holidays, and forward to agents, ring groups, AI, or voicemail.',
  'Neues Menü': 'New menu',
  '{count} Hinweis{plural}': '{count} notice{plural}',
  'Telefonmenü „{name}“ löschen?': 'Delete IVR menu “{name}”?',
  '{count} Schritte': '{count} steps',
  'noch keiner Nummer zugeordnet': 'unassigned to any phone number',
  'Noch kein Telefonmenü. Lege eins an und ordne es unter „Nummern“ einer Rufnummer zu.':
    'No IVR menus yet. Create one and assign it to an inbound phone number under "Numbers".',
  'Neues Telefonmenü': 'New IVR menu',
  Anlegen: 'Create',
  'Zum Beispiel „Hauptnummer“ oder „Support-Hotline“. Du startest mit einem Begrüßungsmenü und baust von dort aus weiter.':
    'For example "Main IVR" or "Support Hotline". Starts with a default greeting menu.',
  'Telefonmenüs, Gruppen und Nummern stellt die Agentur oder ein Mitglied mit Zugriff auf die Einstellungen ein.':
    'IVR menus, groups, and numbers are managed by agency admins or users with settings privileges.',
  Menüs: 'Menus',
  Zeitpläne: 'Schedules',
  'Gruppen & Warteschlangen': 'Groups & Queues',
  Audio: 'Audio',

  // CallsRouting
  Montag: 'Monday',
  Dienstag: 'Tuesday',
  Mittwoch: 'Wednesday',
  Donnerstag: 'Thursday',
  Freitag: 'Friday',
  Samstag: 'Saturday',
  Sonntag: 'Sunday',
  'Zeitplan: {name}': 'Schedule: {name}',
  'Neuer Zeitplan': 'New schedule',
  'Zum Beispiel „Büro“ oder „Support, werktags“.':
    'For example "Office" or "Support, weekdays".',
  Öffnungszeiten: 'Business hours',
  '{label} von': '{label} from',
  '{label} bis': '{label} to',
  'Zeitraum entfernen': 'Remove time interval',
  '＋ Pause einplanen': '＋ Schedule break',
  'Ein Zeitraum über Mitternacht (22:00 bis 02:00) gilt bis zum nächsten Morgen.':
    'Time intervals crossing midnight (e.g. 22:00 to 02:00) remain valid until next morning.',
  Feiertage: 'Holidays',
  'Gesetzliche Feiertage gelten als geschlossen':
    'Statutory public holidays count as closed',
  'Ohne Auswahl gelten nur die bundesweiten Feiertage.':
    'Without selection, only nationwide public holidays apply.',
  'nur bundesweite': 'nationwide only',
  'Zur Kontrolle': 'Verification',
  'Feiertage dieses Jahres anzeigen': 'Show public holidays for this year',
  'Eigene Feiertage und Sonderzeiten': 'Custom holidays and special hours',
  '24-12 oder 2026-12-24': '24-12 or 2026-12-24',
  Datum: 'Date',
  'Name, z. B. Betriebsferien': 'Name, e.g. Company holiday',
  'Eintrag entfernen': 'Remove entry',
  Sonderzeit: 'Special hours',
  'Sonderzeit von': 'Special hours from',
  'Sonderzeit bis': 'Special hours to',
  '＋ Eintrag': '＋ Add entry',
  '„24-12“ gilt jedes Jahr, „2026-12-24“ nur einmal. Eigene Einträge gehen den gesetzlichen Feiertagen vor.':
    '“24-12” recurs annually; “2026-12-24” applies once. Custom entries override statutory holidays.',
  'Wann ist geöffnet – mit Pausen, gesetzlichen Feiertagen und eigenen Sonderzeiten. Ein Telefonmenü fragt den Zeitplan ab und verzweigt.':
    'Define business hours — including breaks, statutory holidays, and custom schedules. Menus route callers based on these schedules.',
  'jetzt geöffnet': 'open now',
  'jetzt geschlossen': 'closed now',
  'Zeitplan „{name}“ löschen?': 'Delete schedule “{name}”?',
  'nie geöffnet': 'never open',
  'Noch kein Zeitplan. Ohne Zeitplan nutzt ein Menü die Geschäftszeiten aus den Telefonie-Einstellungen.':
    'No schedules yet. Without a schedule, menus use business hours configured in Telephony Settings.',
  Gruppe: 'Group',
  'Gruppe: {name}': 'Group: {name}',
  'Neue Ruf-Gruppe oder Warteschlange': 'New ring group or queue',
  'z. B. Support': 'e.g. Support',
  'Anrufer warten mit Musik, bis jemand frei ist.':
    'Callers wait with hold music until an agent is available.',
  'Es klingelt einmal in der Runde, dann der Überlauf.':
    'Rings members once, then routes to overflow destination.',
  'Warteschlange (Anrufer warten)': 'Call queue (callers wait)',
  'Ruf-Gruppe (eine Runde)': 'Ring group (one round)',
  Verteilung: 'Distribution strategy',
  Mitglieder: 'Members',
  'Personen klingeln im Browser-Telefon – nur, solange sie dort erreichbar und nicht im Urlaub oder in einem anderen Gespräch sind. Nummern klingeln immer.':
    'Agents ring in browser phone while active and available. External numbers always ring.',
  'Noch keine Teammitglieder in diesem Projekt.':
    'No team members registered in this project yet.',
  'Nummer(n) hinzufügen, z. B. +49151…': 'Add number(s), e.g. +49151…',
  Hinzufügen: 'Add',
  'Browser-Telefon': 'Browser phone',
  'nach oben': 'Move up',
  'nach unten': 'Move down',
  '{name} entfernen': 'Remove {name}',
  'Klingeldauer pro Versuch (Sekunden)': 'Ring duration per attempt (seconds)',
  'Längste Wartezeit (Sekunden)': 'Max queue wait time (seconds)',
  'Danach greift der Überlauf.': 'Overflow routing triggers after this time.',
  Wartemusik: 'Hold music',
  'Eigene Musik lädst du im Reiter „Audio“ hoch.':
    'Upload custom audio files under the "Audio" tab.',
  'Eingebaute Melodie': 'Default melody',
  'Begrüßung vor dem Warten (optional)':
    'Welcome announcement before queueing (optional)',
  'Alle Mitarbeiter sind im Gespräch.': 'All agents are currently busy.',
  'Platz in der Warteschlange ansagen': 'Announce queue position',
  'Wenn die Wartezeit um ist oder niemand erreichbar ist':
    'When queue wait time expires or no agent is available',
  Überlauf: 'Overflow',
  'Ansage dazu (optional)': 'Announcement audio (optional)',
  '{count} angenommen': '{count} answered',
  'Aufgelegt beim Warten': 'Abandoned while waiting',
  '{count} über den Überlauf': '{count} routed to overflow',
  'längste {dur}': 'longest {dur}',
  'In 20 s angenommen': 'Answered within 20s',
  'Ruf-Gruppen und Warteschlangen': 'Ring Groups & Call Queues',
  'Mehrere Personen oder Nummern für einen Anruf: alle gleichzeitig, der Reihe nach oder reihum. In der Warteschlange hören Anrufer Musik und ihren Platz, bis jemand frei ist.':
    'Route inbound calls to multiple agents or numbers: simultaneous, linear, or round-robin. Callers hear hold music and queue position until connected.',
  'Neue Gruppe': 'New group',
  '{count} wartet': '{count} waiting',
  '„{name}“ löschen?': 'Delete “{name}”?',
  Warteschlange: 'Call queue',
  'Ruf-Gruppe': 'Ring group',
  '{count} Mitglied{plural}': '{count} member{plural}',
  ' · Nummer {nums}': ' · Number {nums}',
  'Noch keine Gruppe. Lege ein Team an, das gemeinsam Anrufe annimmt.':
    'No ring groups configured yet. Create a team group to handle incoming calls.',
  'Voicemail-Drop': 'Voicemail drop',
  'Bitte eine MP3- oder WAV-Datei wählen.':
    'Please select an MP3 or WAV audio file.',
  Hochgeladen: 'Uploaded',
  'Aufnahme erzeugt': 'Recording generated',
  'Neue Audiodatei': 'New audio file',
  'Twilio spielt MP3 und WAV ab. Ansagen für Menüs, Musik für die Warteschlange, Voicemail-Drops für den Power-Dialer.':
    'Twilio supports MP3 and WAV playback. Use for IVR prompts, queue music, and dialer voicemail drops.',
  'z. B. Begrüßung Hauptnummer': 'e.g. Main greeting',
  'Datei hochladen (MP3 oder WAV)': 'Upload file (MP3 or WAV)',
  Hochladen: 'Upload',
  'oder aus einem Text sprechen lassen': 'or generate speech from text',
  'Nutzt die Stimme aus den Spracheinstellungen. Die Datei ist danach fest gespeichert.':
    'Uses voice configured in speech settings. Generated audio is stored permanently.',
  'Aufnahme erzeugen': 'Generate audio',
  'Deine Dateien': 'Your audio files',
  'Ohne eigene Wartemusik spielt die Warteschlange eine eingebaute Melodie.':
    'Without custom hold music, queues play the default melody.',
  'Noch keine eigenen Dateien.': 'No custom audio files uploaded yet.',
  'Welche Nummer in welches Menü, welche Gruppe oder zu welcher Person führt, stellst du unter ':
    'Configure which number routes to which menu, group, or agent under ',
  'Anrufe → Nummern': 'Calls → Numbers',
  ' ein.': '.',
  'Für … drücken Sie die 1, für … die 2.': 'For … press 1, for … press 2.',
  'Anrufe (30 Tage)': 'Calls (30 days)',
  Wartezeit: 'Wait time',
};
