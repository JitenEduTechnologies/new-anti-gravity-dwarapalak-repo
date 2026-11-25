export default {
  // Ops
  ist: 'is',
  'ist nicht': 'is not',
  enthält: 'contains',
  'hat / enthält': 'has / contains',
  'hat nicht': 'does not have',
  'ist leer': 'is empty',
  'ist nicht leer': 'is not empty',
  'größer als': 'greater than',
  'kleiner als': 'less than',

  // Contact Fields
  Quelle: 'Source',
  'E-Mail': 'Email',
  Telefon: 'Phone',
  'Firma (Text)': 'Company (text)',
  Webseite: 'Website',
  Ort: 'City',
  PLZ: 'Postal code',
  Land: 'Country',
  Vorname: 'First name',
  Nachname: 'Last name',

  // Company Fields
  'Firma: Branche': 'Company: Industry',
  'Firma: Größe': 'Company: Size',
  'Firma: Phase': 'Company: Lifecycle stage',
  'Firma: Ort': 'Company: City',
  'Firma: Land': 'Company: Country',
  'Firma: Domain': 'Company: Domain',

  // Attribution Fields
  'Erste Quelle (UTM)': 'First source (UTM)',
  'Letzte Quelle (UTM)': 'Last source (UTM)',
  'Erstes Medium': 'First medium',
  'Letztes Medium': 'Last medium',
  'Erste Kampagne': 'First campaign',
  'Letzte Kampagne': 'Last campaign',
  'Anzahl Besuche': 'Number of visits',

  // Custom Field labels
  'Feld: {label}': 'Field: {label}',
  Tag: 'Tag',
  'Firma: {label}': 'Company: {label}',

  // Rule Row
  Punkte: 'Points',
  'Pkt.': 'pts.',
  'Kriterium entfernen': 'Remove criterion',
  Ereignis: 'Event',
  'je Mal, höchstens': 'per occurrence, max',
  Höchstpunkte: 'Maximum points',
  in: 'within',
  allen: 'all',
  'Zeitraum in Tagen': 'Timeframe in days',
  Tagen: 'days',
  Feld: 'Field',
  Bedingung: 'Condition',
  'Tag wählen…': 'Select tag…',
  Wert: 'Value',

  // Model Editor
  'Gespeichert und neu berechnet': 'Saved and recalculated',
  'Name des Modells': 'Model name',
  Aktiv: 'Active',
  'Haupt-Score (Kontaktliste)': 'Primary score (contact list)',
  Eigenschaften: 'Properties',
  '– passt der Kontakt?': '– does the contact fit?',
  '+ Eigenschaft': '+ Property',
  Aktivität: 'Activity',
  '– wie engagiert ist er?': '– how engaged are they?',
  '+ Aktivität': '+ Activity',
  'Negative Punkte ziehen ab (z. B. Freemail-Adresse, Wettbewerber-Domain). Der Score fällt nie unter 0.':
    'Negative points deduct (e.g. freemail address, competitor domain). The score never falls below 0.',
  'Modell „{name}“ löschen? Alle Scores und der Verlauf gehen verloren.':
    'Delete model “{name}”? All scores and history will be lost.',
  Gelöscht: 'Deleted',
  Löschen: 'Delete',
  'Neu berechnet': 'Recalculated',
  'Neu berechnen': 'Recalculate',
  Speichern: 'Save',
  'Gespeichert ✓': 'Saved ✓',

  // Side panels
  Schwellen: 'Thresholds',
  'Name der Schwelle': 'Threshold name',
  ab: 'from',
  Mindestpunkte: 'Minimum points',
  'Schwelle entfernen': 'Remove threshold',
  '+ Schwelle': '+ Threshold',
  'Erreicht ein Kontakt eine Schwelle, startet der Workflow-Auslöser „Lead-Score erreicht Schwelle“.':
    'When a contact reaches a threshold, the workflow trigger “Lead score reached threshold” starts.',
  'Zerfall & Grenze': 'Decay & limit',
  Prozent: 'Percent',
  '% je': '% every',
  Tage: 'Days',
  'Tage ohne Aktivität': 'days without activity',
  'Höchstwert (leer = keiner)': 'Maximum score (empty = none)',
  'z. B. 100': 'e.g. 100',
  'Jede Nacht neu berechnet (Zerfall, Zeiträume), sonst sofort bei neuen Ereignissen.':
    'Recalculated every night (decay, periods), otherwise immediately upon new events.',
  Verteilung: 'Distribution',
  '{scored} Kontakte bewertet · Ø {average} Punkte{calc}':
    '{scored} contacts scored · avg {average} points{calc}',
  ' · berechnet {dt}': ' · calculated {dt}',
  darunter: 'below',
  'Top-Leads': 'Top leads',

  // Main page
  'Modell angelegt': 'Model created',
  'Lead-Scoring': 'Lead Scoring',
  'Punkte für passende Eigenschaften und Aktivität – Schwellen wie MQL und SQL starten Workflows':
    'Points for matching properties and activity – thresholds like MQL and SQL trigger workflows',
  '+ Modell': '+ Model',
  'Erstes Scoring-Modell anlegen': 'Create first scoring model',
  'Noch kein Lead-Scoring. Wir starten mit einer Vorlage (Formulare, Klicks, Termine), die du anpasst.':
    'No lead scoring yet. We start with a template (forms, clicks, bookings) that you can customize.',
  pausiert: 'paused',

  // Contact Lead Score
  'Lead-Score': 'Lead Score',
  'Noch keine Punkte.': 'No points yet.',
  'Verlauf ({count})': 'History ({count})',

  // Trigger filters
  'Erst unter ': 'First create a model under ',
  ' ein Modell anlegen.': '.',
  Modell: 'Model',
  jedes: 'any',
  Schwelle: 'Threshold',
  jede: 'any',
  Richtung: 'Direction',
  beide: 'both',
  gestiegen: 'increased',
  gefallen: 'decreased',
  'Neuer Score mindestens': 'New score at least',
  'Platzhalter: {{event.score}}, {{event.label}}, {{event.previous}}.':
    'Placeholders: {{event.score}}, {{event.label}}, {{event.previous}}.',
};
