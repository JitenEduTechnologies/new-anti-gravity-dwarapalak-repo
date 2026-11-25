export default {
  // ContactPicker
  Kontakt: 'Contact',
  Ändern: 'Change',
  'Kontakt suchen': 'Search contact',
  'Name, Firma oder E-Mail': 'Name, company or email',

  // PaperDialog
  'Papier-Mandat erfassen': 'Record paper mandate',
  'Mandat speichern': 'Save mandate',
  'Für Mandate, die unterschrieben auf Papier (oder als PDF) vorliegen. Bewahre das Original auf – bis 14 Monate nach dem letzten Einzug.':
    'For mandates signed on paper (or available as PDF). Retain the original for up to 14 months following the last collection.',
  Kontoinhaber: 'Account holder',
  IBAN: 'IBAN',
  'DE89 3704 0044 0532 0130 00': 'DE89 3704 0044 0532 0130 00',
  'BIC (optional)': 'BIC (optional)',
  'Pflicht außerhalb des EWR (z. B. CH, GB)': 'Mandatory outside EEA (e.g. CH, GB)',
  'Unterschrieben am': 'Signed on',
  'Ort der Unterschrift': 'Place of signature',
  Lastschriftart: 'Direct debit scheme',
  'Basislastschrift (CORE)': 'Core Direct Debit (CORE)',
  'Firmenlastschrift (B2B)': 'B2B Direct Debit (B2B)',
  'Mandat für': 'Mandate for',
  'Wiederkehrende Zahlungen': 'Recurring payments',
  'Eine einmalige Zahlung': 'One-off payment',
  'Mandatsreferenz (optional)': 'Mandate reference (optional)',
  'Leer lassen: HyperLevel vergibt die nächste Nummer. Die Referenz auf dem Papier-Mandat muss genau so lauten.':
    'Leave blank: HyperLevel assigns the next number. The reference on paper must match exactly.',
  'Anschrift des Kontoinhabers (außerhalb des EWR Pflicht)':
    'Account holder address (mandatory outside EEA)',
  'Straße und Hausnummer': 'Street and house number',
  PLZ: 'Postal code',
  Ort: 'City',
  'Land (Kürzel)': 'Country code',
  DE: 'DE',
  'Mandat gespeichert': 'Mandate saved',

  // RequestDialog
  'Online-Mandat anfordern': 'Request online mandate',
  Fertig: 'Done',
  'Link erzeugen': 'Generate link',
  'Online-Mandat angelegt': 'Online mandate created',
  'Der Link ist per E-Mail unterwegs.': 'Link sent via email.',
  'Nicht gesendet: {error}': 'Not sent: {error}',
  'Gib den Link an die Person weiter.': 'Share this link with the contact.',
  'Link zum Mandat {ref}': 'Link to mandate {ref}',
  'Gültig bis {date}. Die Person liest den Mandatstext, trägt ihr Konto ein und bestätigt – gespeichert werden Zeitpunkt, IP-Netz, Browser-Fingerabdruck und die Prüfsumme des Textes.':
    'Valid until {date}. The contact reviews the mandate terms, inputs bank details, and confirms – timestamp, IP subnet, browser fingerprint, and checksum are recorded.',
  'Die Person bekommt einen persönlichen Link zu einer Seite mit dem Mandatstext. Dort trägt sie ihr Konto selbst ein – du siehst die IBAN danach maskiert in der Liste.':
    'The contact receives an individual link to the mandate page. They submit bank details directly – masked IBAN will be displayed in your list.',
  'Link gleich per E-Mail an den Kontakt senden':
    'Send link immediately to contact via email',

  // MandateDialog
  'SEPA-Mandat': 'SEPA mandate',
  'SEPA-Mandat {ref}': 'SEPA mandate {ref}',
  'Warum endet das Mandat? (z. B. „Kunde hat widerrufen“)':
    'Why is the mandate ending? (e.g. “Revoked by customer”)',
  'Mandat widerrufen': 'Mandate revoked',
  'Mandat wieder freigegeben': 'Mandate reactivated',
  'Wieder freigeben': 'Reactivate',
  'Wieder normale Folgelastschrift': 'Restore standard recurring collection',
  'Nächster Einzug ist der letzte': 'Next collection is final',
  'Doch nicht der letzte Einzug': 'Not the final collection',
  Widerrufen: 'Revoke',
  'nicht (mehr) zugeordnet': 'not (or no longer) assigned',
  Status: 'Status',
  'Nächste Lastschrift': 'Next direct debit',
  'eine einmalige Zahlung': 'one-off payment',
  'wiederkehrende Zahlungen': 'recurring payments',
  BIC: 'BIC',
  Anschrift: 'Address',
  Unterschrieben: 'Signed',
  ' in {place}': ' in {place}',
  Erfasst: 'Recorded',
  'online über den Mandats-Link': 'online via mandate link',
  importiert: 'imported',
  'Papier-Mandat': 'paper mandate',
  'Erste / letzte Lastschrift': 'First / last collection',
  'Läuft ab': 'Expires',
  '{date} (36 Monate ohne Einzug)': '{date} (36 months without collection)',
  Beendet: 'Ended',
  'Link zum Mandat': 'Mandate link',
  'Gültig bis {date}': 'Valid until {date}',
  'Der Link ist abgelaufen.': 'The link has expired.',
  'Neuen Link per E-Mail senden': 'Send new link via email',
  'Neuer Link gesendet': 'New link sent',
  'Nur neuen Link erzeugen': 'Generate new link only',
  'Neuer Link erzeugt': 'New link generated',
  'Nachweis der Zustimmung': 'Proof of consent',
  Zeitpunkt: 'Timestamp',
  'IP-Netz': 'IP subnet',
  'Browser-Fingerabdruck': 'Browser fingerprint',
  'Prüfsumme des Textes (SHA-256)': 'Text checksum (SHA-256)',
  Mandatstext: 'Mandate terms',
  Lastschriften: 'Direct debits',
  bezahlt: 'paid',
  'zurück {code}': 'returned {code}',
  entfernt: 'removed',
  angekündigt: 'pre-notified',
  eingereicht: 'submitted',
  Rechnung: 'Invoice',
  'fällig {date}': 'due {date}',
  'Noch keine Lastschrift mit diesem Mandat.':
    'No direct debits under this mandate yet.',

  // MandatesTab
  Mandate: 'Mandates',
  'Ohne gültiges Mandat keine Lastschrift. Ein Mandat läuft ab, wenn 36 Monate lang nichts eingezogen wurde.':
    'Direct debit requires a valid mandate. A mandate expires after 36 months of inactivity.',
  Suchen: 'Search',
  'Referenz, Inhaber, Kontakt': 'Reference, holder, contact',
  Alle: 'All',
  Aktiv: 'Active',
  'Wartet auf Unterschrift': 'Awaiting signature',
  Gesperrt: 'Suspended',
  'Beendet / abgelaufen': 'Ended / expired',
  'Noch keine Mandate. Fordere ein Online-Mandat an oder erfasse ein unterschriebenes Papier-Mandat.':
    'No mandates yet. Request an online mandate or record a signed paper mandate.',
  einmalig: 'one-off',
  wiederkehrend: 'recurring',
  'unterschrieben {date}': 'signed {date}',
  'Link abgelaufen': 'Link expired',

  // SettingsTab
  'Gebühr: bitte einen Betrag wie 3,50 eingeben':
    'Fee: please enter an amount like 3.50',
  'Einstellungen gespeichert': 'Settings saved',
  Zahlungsempfänger: 'Creditor',
  'Die Gläubiger-ID bekommst du kostenlos bei der Deutschen Bundesbank (online beantragen).':
    'Obtain your Creditor Identifier (Gläubiger-ID) free of charge from your central banking authority.',
  'Gläubiger-Identifikationsnummer': 'Creditor Identifier (Gläubiger-ID)',
  'z. B. DE98ZZZ09999999999 – wird mit Prüfziffern geprüft':
    'e.g. DE98ZZZ09999999999 – validated with check digits',
  'Name des Zahlungsempfängers': 'Creditor name',
  'Leer: {name}': 'Blank: {name}',
  'Name aus den Rechnungs-Einstellungen': 'Name from invoice settings',
  'Eigene IBAN': 'Own IBAN',
  'Leer: {iban} (Rechnungs-Einstellungen)': 'Blank: {iban} (Invoice settings)',
  'Das Konto, auf dem die Lastschriften eingehen und von dem Überweisungen abgehen':
    'The bank account for direct debit receipts and outbound credit transfers',
  'Eigene BIC (optional)': 'Own BIC (optional)',
  'Standard-Lastschriftart': 'Default scheme',
  'Basislastschrift (CORE) – Verbraucher und Firmen':
    'Core Direct Debit (CORE) – consumers and businesses',
  'Firmenlastschrift (B2B) – nur Firmen, kein Widerspruch':
    'B2B Direct Debit (B2B) – businesses only, no refund rights',
  Vorabankündigung: 'Pre-notification',
  'Vor jedem Einzug erfährt der Kunde Betrag und Datum. Standard sind 14 Tage; kürzer (mindestens 1 Tag) nur, wenn es im Mandat steht – HyperLevel schreibt die Frist in den Mandatstext.':
    'Customers receive advance notice of amount and collection date. Default is 14 days; shorter notice requires explicit mandate agreement.',
  'Vorlauf in Tagen': 'Notice period in days',
  'Vorabankündigung beim Anlegen eines Laufs per E-Mail senden':
    'Send pre-notification via email when generating a run',
  Betreff: 'Subject',
  Text: 'Text',
  'Platzhalter: {{due_date}}, {{total}}, {{items}}, {{iban}} (maskiert), {{mandate_reference}}, {{creditor_id}}, {{creditor_name}}, {{contact.first_name}}, {{location.name}}':
    'Placeholders: {{due_date}}, {{total}}, {{items}}, {{iban}} (masked), {{mandate_reference}}, {{creditor_id}}, {{creditor_name}}, {{contact.first_name}}, {{location.name}}',
  'Mandate und Dateien': 'Mandates and Files',
  'Präfix der Mandatsreferenz': 'Mandate reference prefix',
  'z. B. M- → M-2026-000001': 'e.g. M- → M-2026-000001',
  'Mandats-Link gültig (Tage)': 'Mandate link validity (days)',
  'Sammelbuchung: einen Betrag je Lauf auf dem Kontoauszug (sonst jede Lastschrift einzeln – leichter abzugleichen)':
    'Batch booking: single lump sum per run on statement (otherwise each debit individual – easier reconciliation)',
  'Vorschlag Rücklastschrift-Gebühr (€)': 'Default return fee (₹ / €)',
  'Steht im Rückgabe-Dialog vor; nur die echten Bankkosten weitergeben.':
    'Preset in return dialog; pass on actual banking charges only.',
  'Einstellungen speichern': 'Save settings',

  // Main Sepa
  SEPA: 'SEPA & Direct Debit',
  'Lastschriften mit eigenem Mandat einziehen und Überweisungsdateien erzeugen – ohne Zahlungsanbieter. Die Dateien lädst du im Online-Banking hoch.':
    'Collect direct debits under own mandates and generate bank transfer files – without intermediary gateways. Upload XML directly to your online banking portal.',
  Einzug: 'Collection',
  Läufe: 'Runs',
  Überweisungen: 'Credit Transfers',
  Einstellungen: 'Settings',
  'Aktive Mandate': 'Active mandates',
  '{count} warten auf Unterschrift': '{count} awaiting signature',
  Einziehbar: 'Collectible',
  '{count} Rechnungen': '{count} invoices',
  'Eingereicht, offen': 'Submitted, open',
  '{count} Lastschriften': '{count} direct debits',
  'Rücklastschriften (30 Tage)': 'Returns (30 days)',
  'Noch nicht bereit für Lastschriften:': 'Not yet ready for direct debit:',
  'Zu den Einstellungen': 'Go to settings',

  // SepaRuns: CollectTab
  'Lauf angelegt, Vorabankündigungen gesendet':
    'Run created, pre-notifications dispatched',
  'Lauf angelegt': 'Run created',
  'Offene Rechnungen mit Mandat': 'Open invoices with mandate',
  'Festgeschriebene, offene Rechnungen in Euro von Kontakten mit aktivem Mandat. Vorabankündigung {days} {unit} vorher.':
    'Finalized, open invoices from contacts with an active mandate. Pre-notification {days} {unit} in advance.',
  Tag: 'day',
  Tage: 'days',
  'Keine wählen': 'Deselect all',
  'Alle wählen': 'Select all',
  'Keine einziehbare Rechnung. Rechnungen erscheinen hier, sobald sie festgeschrieben und offen sind und der Kontakt ein aktives Mandat hat.':
    'No collectible invoices. Invoices appear here once finalized, open, and linked to an active mandate.',
  'Mandat {ref} · {iban}': 'Mandate {ref} · {iban}',
  Vorschau: 'Preview',
  'Je Lastschriftart und Sequenztyp entsteht ein eigener Block in der Datei.':
    'Each scheme and sequence type generates a distinct payment information block in the XML.',
  'Fälligkeit (Einzugsdatum)': 'Collection date',
  'Frühestens {date} – ein Bankarbeitstag (TARGET2)':
    'Earliest {date} – banking business day (TARGET2 / RTGS)',
  Block: 'Block',
  Anzahl: 'Count',
  Summe: 'Sum',
  Gesamt: 'Total',
  'Vorabankündigung jetzt per E-Mail senden (aus: ich kündige selbst an, z. B. auf der Rechnung)':
    'Send pre-notification via email now (off: notify manually, e.g. on invoice)',
  'Lauf anlegen': 'Create run',
  ' & Vorabankündigung senden': ' & send pre-notification',
  'Eingereicht wird erst im nächsten Schritt: Dann entsteht die Datei (pain.008), die du im Online-Banking hochlädst.':
    'Submission occurs in the next step: generating the pain.008 XML file for your banking portal.',

  // SepaRuns: ReturnDialog
  'Rücklastschrift {id}': 'Return debit {id}',
  'Rücklastschrift erfasst – die Rechnung ist wieder offen':
    'Return debit recorded – invoice reopened',
  'Rücklastschrift erfassen': 'Record return debit',
  'Die Zahlung auf der Rechnung wird zurückgenommen ({money}), die Rechnung ist danach wieder offen und kann erneut eingezogen oder gemahnt werden.':
    'Payment on the invoice is reversed ({money}); the invoice is reopened and can be collected again or dunned.',
  'Rückgabegrund (laut Bank)': 'Return reason code (from bank)',
  'Dieser Grund beendet das Mandat – für weitere Lastschriften braucht es ein neues.':
    'This reason revokes the mandate – a new mandate is required for future debits.',
  'Dieser Grund sperrt das Mandat, bis du die Daten geprüft und es wieder freigegeben hast.':
    'This reason suspends the mandate until bank details are verified and reactivated.',
  'Gebühr der Bank (€)': 'Bank charge (₹ / €)',
  optional: 'optional',
  'Gebühr als Rechnungsentwurf an den Kunden anlegen':
    'Invoice the return fee to customer as a draft',
  Notiz: 'Note',

  // SepaRuns: RunDialog
  'SEPA-Lauf': 'SEPA run',
  'Eingereicht – die Datei steht bereit': 'Submitted – file ready',
  'Nicht in der Datei:\n{dropped}': 'Excluded from file:\n{dropped}',
  'Lauf verwerfen – Grund (optional):': 'Discard run – reason (optional):',
  'Lauf zurückziehen (z. B. „Bank hat die Datei abgelehnt“):':
    'Recall run (e.g. “Bank rejected file”):',
  'Lauf verworfen': 'Run discarded',
  'Lauf zurückgezogen': 'Run recalled',
  'Einreichen & Datei erzeugen': 'Submit & generate file',
  'XML herunterladen': 'Download XML',
  'Alle {count} eingereichten Posten als bezahlt markieren?':
    'Mark all {count} submitted items as paid?',
  'Als bezahlt markiert': 'Marked as paid',
  'Alle als bezahlt': 'Mark all as paid',
  'Vorabankündigung erneut gesendet': 'Pre-notification resent',
  'Vorabankündigung erneut senden': 'Resend pre-notification',
  Verwerfen: 'Discard',
  Zurückziehen: 'Recall',
  Fälligkeit: 'Due date',
  Ausführung: 'Execution',
  Posten: 'Items',
  '{count} · {money}': '{count} · {money}',
  'Nachricht (MsgId)': 'Message ID (MsgId)',
  Eingereicht: 'Submitted',
  'noch nicht': 'not yet',
  Datei: 'File',
  'Die Vorabankündigung ist raus. Reiche den Lauf spätestens einen Bankarbeitstag vor der Fälligkeit ein: Dann entsteht die Datei, die du im Online-Banking hochlädst.':
    'Pre-notification dispatched. Submit run at least one banking day before execution date to generate the XML file for upload.',
  Empfänger: 'Recipient',
  Sequenz: 'Sequence',
  'Vorabankündigung fehlgeschlagen: {error}':
    'Pre-notification failed: {error}',
  'Vorabankündigung selbst zugestellt': 'Pre-notification sent manually',
  Bezahlt: 'Paid',
  Ausgeführt: 'Executed',
  'Als ausgeführt markiert': 'Marked as executed',
  Rücklastschrift: 'Return debit',

  // SepaRuns: RunsTab
  'Jeder Lauf ist eine Datei für die Bank. Bezahlte und zurückgegebene Lastschriften trägst du hier ein – die Rechnung folgt automatisch.':
    'Each run corresponds to a bank file. Record settled and returned debits here – invoice status updates automatically.',
  'Noch keine Läufe.': 'No runs yet.',
  '{count} Posten': '{count} items',
  'angelegt {date}': 'created {date}',
  'eingereicht {date}': 'submitted {date}',

  // SepaRuns: TransfersTab
  'Zeile {n}: bitte einen Betrag wie 120,00 eingeben':
    'Line {n}: please enter an amount like 120.00',
  'Überweisungsdatei erzeugt': 'Credit transfer file generated',
  'Offene Eingangsrechnungen': 'Open supplier bills',
  'Gebuchte, noch nicht bezahlte Belege aus der Buchhaltung. Bezahlt gilt ein Beleg erst, wenn der Bankabgleich die Zahlung findet.':
    'Posted, unpaid bills from accounting. A bill is marked paid when bank reconciliation identifies matching payment.',
  'Die Buchhaltung ist hier nicht verfügbar – nutze die Auszahlungsliste.':
    'Accounting module is not enabled – use the manual payout list.',
  'Keine offenen Eingangsrechnungen.': 'No open supplier bills.',
  Lieferant: 'Supplier',
  'ohne IBAN': 'without IBAN',
  Auszahlungsliste: 'Payout list',
  'Weitere Empfänger von Hand, z. B. Erstattungen oder Honorare.':
    'Manual recipient list, e.g. reimbursements or contractor fees.',
  'Zeile hinzufügen': 'Add line',
  'Keine Zeilen.': 'No lines.',
  'Betrag (€)': 'Amount (₹ / €)',
  Verwendungszweck: 'Remittance information',
  'Zeile entfernen': 'Remove line',
  'Datei erzeugen': 'Generate file',
  'pain.001.001.09 von deinem eigenen Konto (SEPA → Einstellungen).':
    'pain.001.001.09 outbound payment file from your configured account (SEPA → Settings).',
  Ausführungsdatum: 'Execution date',
  Belege: 'Bills',
  'Überweisungsdatei erzeugen': 'Generate transfer file',
};
