export default {
  // Status
  Entwurf: 'Draft',
  gesendet: 'sent',
  geöffnet: 'viewed',
  unterschrieben: 'signed',
  abgelehnt: 'declined',
  storniert: 'void',

  // List Page
  Verträge: 'Contracts',
  'Online unterschreiben lassen – mit Prüfsumme und Protokoll': 'Get signed online – with audit trail and checksum',
  Vorlage: 'Template',
  Vertrag: 'Contract',
  Vorlagen: 'Templates',
  Titel: 'Title',
  Kunde: 'Contact',
  Status: 'Status',
  Geändert: 'Updated',
  'Noch keine Vorlagen – z. B. Website-Vertrag, Wartungsvertrag, AV-Vertrag.':
    'No templates yet – e.g. service agreement, maintenance contract, NDA.',
  'Noch keine Verträge.': 'No contracts yet.',

  // New Contract Modal
  'Neuer Vertrag': 'New contract',
  'Neue Vorlage': 'New template',
  Anlegen: 'Create',
  'Beispiel-Vertrag': 'Sample contract',

  // Contact Picker
  ändern: 'change',
  'Kontakt suchen…': 'Search contact…',

  // Editor Page
  Speichern: 'Save',
  Senden: 'Send',
  'Erneut senden': 'Resend',
  Ansehen: 'View',
  Stornieren: 'Void',
  Löschen: 'Delete',
  'Vertrag stornieren? Der Link funktioniert dann nicht mehr.': 'Void contract? The link will no longer work.',
  'Löschen?': 'Delete?',
  Gespeichert: 'Saved',
  'Unterzeichner (Kontakt)': 'Signer (Contact)',
  Vertragstext: 'Contract text',
  '# Überschrift · - Liste · **fett** · Platzhalter wie {{contact.full_name}}, {{contact.company}}, {{location.name}} werden beim Senden eingesetzt.':
    '# Heading · - List · **bold** · Placeholders like {{contact.full_name}}, {{contact.company}}, {{location.name}} are populated upon sending.',
  Unterschrift: 'Signature',
  'Abgelehnt am {date}.': 'Declined on {date}.',
  'Noch nicht gesendet. Nach dem Senden ist der Text fest – Änderungen nur per neuem Vertrag.':
    'Not yet sent. Once sent, the text is locked – changes require a new contract.',
  'Gesendet am {date}{opened}.': 'Sent on {date}{opened}.',
  ', geöffnet am {date}': ', opened on {date}',
  ', noch nicht geöffnet': ', not yet opened',
  'Link zum Unterschreiben': 'Signing link',

  // Send Modal
  'Vertrag senden': 'Send contract',
  'Bitte unterschreiben: {{contract.title}}': 'Please sign: {{contract.title}}',
  'Hallo {{contact.first_name|}},\n\nhier ist der Vertrag „{{contract.title}}“ zum Lesen und Unterschreiben:\n{{contract.url}}\n\nViele Grüße\n{{location.name}}':
    'Hello {{contact.first_name|}},\n\nhere is the contract “{{contract.title}}” for your review and signature:\n{{contract.url}}\n\nBest regards,\n{{location.name}}',
  'E-Mail': 'Email',
  SMS: 'SMS',
  Betreff: 'Subject',
  'Nachricht ({{contract.url}} = Link)': 'Message ({{contract.url}} = link)',
  'Nicht gesendet: {error}': 'Not sent: {error}',
  Gesendet: 'Sent',
};
