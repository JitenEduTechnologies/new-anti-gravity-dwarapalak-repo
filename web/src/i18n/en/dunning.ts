export default {
  // CaseDialog
  Zahlungsausfall: 'Payment failure',
  'Erinnerung gesendet': 'Reminder sent',
  'Erinnerung senden': 'Send reminder',
  'Zahlung erneut versucht': 'Payment retried',
  'Jetzt erneut einziehen': 'Retry collection now',
  'Zugang fortgesetzt': 'Access resumed',
  'Zugang pausiert': 'Access paused',
  'Zugang fortsetzen': 'Resume access',
  'Zugang pausieren': 'Pause access',
  'Fall geschlossen': 'Case closed',
  'Fall schließen': 'Close case',
  'Warum schließt du den Fall? (z. B. „hat per Überweisung bezahlt“)':
    'Why are you closing the case? (e.g. “paid via bank transfer”)',
  Kontakt: 'Contact',
  'nicht zugeordnet': 'unassigned',
  'Kontakt öffnen': 'Open contact',
  Produkt: 'Product',
  Betrag: 'Amount',
  Status: 'Status',
  Versuche: 'Attempts',
  'Erster Fehlschlag': 'First failure',
  'Nächster Versuch': 'Next attempt',
  Zugang: 'Access',
  pausiert: 'paused',
  aktiv: 'active',
  Grund: 'Reason',
  'Wieder bezahlt': 'Recovered',
  Geschlossen: 'Closed',
  Verlauf: 'History',
  'Noch keine Einträge.': 'No entries yet.',

  // Events
  'Fall eröffnet': 'Case opened',
  'Zahlung fehlgeschlagen': 'Payment failed',
  'Erneut versucht': 'Retried',
  'Endgültig fehlgeschlagen': 'Permanently failed',
  'Karte aktualisiert': 'Card updated',

  // BillingLinkDialog
  'Link zur Abo-Verwaltung': 'Subscription management link',
  'Der Link führt zu einer Seite, auf der die Person Zahlungsmethode, Rechnungen und Abo selbst verwaltet – ohne Login. Er gilt nur für diese Person und läuft ab.':
    'The link leads to a page where the person manages their payment method, invoices and subscription themselves – without login. It is valid only for this person and expires.',
  'Kontakt suchen': 'Search contact',
  'Name oder E-Mail': 'Name or email',
  Ändern: 'Change',
  'Link erzeugen': 'Generate link',
  'Per E-Mail senden': 'Send via email',
  'Per SMS senden': 'Send via SMS',
  Gesendet: 'Sent',
  'Gültig bis {date}.': 'Valid until {date}.',
  ' Gesendet per {channel}.': ' Sent via {channel}.',
  'E-Mail': 'Email',
  SMS: 'SMS',

  // CasesTab
  'Offene Fälle': 'Open cases',
  'Stripe versucht es noch': 'Stripe is still trying',
  'Endgültig gescheitert': 'Permanently failed',
  'Zugang laut Einstellung pausiert': 'Access paused according to settings',
  'Gefährdeter Umsatz': 'Revenue at risk',
  'In 30 Tagen zurückgeholt': 'Recovered in 30 days',
  'Stripe ist nicht verbunden.': 'Stripe is not connected.',
  'Ohne Stripe-Webhook sieht das Mahnwesen keine Zahlungsausfälle. Verbinde Stripe unter ':
    'Without Stripe webhook, dunning cannot track payment failures. Connect Stripe under ',
  '; die nötigen Ereignisse stehen in der Anleitung.':
    '; required events are in the documentation.',
  'Einstellungen → Stripe': 'Settings → Stripe',
  'Das Mahnwesen für Abo-Zahlungen ist ausgeschaltet (Reiter Einstellungen).':
    'Dunning for subscription payments is disabled (Settings tab).',
  'Zahlungsausfälle bei Abos und Raten': 'Payment failures for subscriptions & instalments',
  'Wer zahlt nicht? Jeder Fall bekommt Erinnerungen mit einem Link, über den die Person ihre Karte selbst aktualisiert.':
    'Who hasn’t paid? Each case receives reminders with a link allowing the person to update their card directly.',
  'Offen und gescheitert': 'Open and failed',
  Alle: 'All',
  'Abo-Link erzeugen': 'Generate subscription link',
  'Kontakt unbekannt': 'Unknown contact',
  Abo: 'Subscription',
  'Seit {date} · {attempts} Versuch{plural}': 'Since {date} · {attempts} attempt{plural}',
  ' · nächster {date}': ' · next {date}',
  ' · {reason}': ' · {reason}',
  'Keine offenen Zahlungsausfälle – gut so.': 'No open payment failures – all clear.',
  'Keine Fälle in dieser Ansicht.': 'No cases in this view.',

  // NoticeDialog
  'PDF ansehen': 'View PDF',
  Verworfen: 'Dismissed',
  Verwerfen: 'Dismiss',
  'Speichern und senden': 'Save and send',
  'Jetzt senden': 'Send now',
  'Dieselbe Mahnung noch einmal senden?': 'Send the same reminder again?',
  'Erneut gesendet': 'Resent',
  'Erneut senden': 'Resend',
  Rechnung: 'Invoice',
  'Mahngebühren früherer Schreiben': 'Fees from previous reminders',
  Mahngebühr: 'Dunning fee',
  Verzugszinsen: 'Default interest',
  'Pauschale (§ 288 Abs. 5 BGB)': 'Statutory flat fee',
  Gesamt: 'Total',
  Zahlungsfrist: 'Payment deadline',
  'Tage überfällig': 'Days overdue',
  Fehler: 'Error',
  Betreff: 'Subject',
  Text: 'Text',
  'Beträge und Frist stehen im PDF; der Text darf angepasst werden.':
    'Amounts and deadlines are in the PDF; message text can be customized.',
  'Mahnung gesendet': 'Reminder sent',

  // InvoicesTab
  'Das Rechnungs-Mahnwesen ist aus.': 'Invoice dunning is disabled.',
  ' Es verschickt nichts, bis du es einschaltest – zuerst mit Freigabe, später gern automatisch. ':
    ' Nothing will be sent until you enable it – first with approval, later automatically if desired. ',
  'Mit Freigabe:': 'With approval:',
  ' Fällige Mahnungen warten hier, bis du sie prüfst und sendest. ':
    ' Due reminders wait here until reviewed and approved. ',
  'Automatisch:': 'Automatic:',
  ' Fällige Mahnungen gehen sofort raus. Mahnstopp pro Rechnung ist möglich. ':
    ' Due reminders are sent immediately. Per-invoice dunning holds are supported. ',
  Einstellungen: 'Settings',
  'Jetzt prüfen (Trockenlauf)': 'Run check now (Dry run)',
  'Die nächste Mahnung zu Rechnung {number} jetzt an {name} senden?':
    'Send the next reminder for invoice {number} to {name} now?',
  'Entwurf liegt zur Freigabe bereit': 'Draft is ready for approval',
  'Grund für den Mahnstopp (z. B. „Zahlungsvereinbarung“)':
    'Reason for dunning hold (e.g. “Payment plan agreed”)',
  'Mahnstopp gesetzt': 'Dunning hold placed',
  'Mahnstopp aufheben': 'Remove dunning hold',
  'Mahnstopp aufgehoben': 'Dunning hold removed',
  'Wartet auf Freigabe': 'Awaiting approval',
  'Prüfen, Text anpassen, senden oder verwerfen.':
    'Review, edit text, send or dismiss.',
  'Nichts zur Freigabe.': 'Nothing awaiting approval.',
  'Überfällige Rechnungen': 'Overdue invoices',
  'Offene Rechnungen mit abgelaufener Frist.':
    'Open invoices with expired payment deadlines.',
  'Entwurf: {label}': 'Draft: {label}',
  Mahnstopp: 'Dunning hold',
  '{days} Tage überfällig · ': '{days} days overdue · ',
  '{level} wartet auf Freigabe': '{level} awaiting approval',
  'Stand: {level}': 'Status: {level}',
  ' · als Nächstes {next} ({total})': ' · next: {next} ({total})',
  ' · alle Stufen durch': ' · all levels completed',
  ' · Mahnstopp': ' · Dunning hold',
  'Keine überfälligen Rechnungen.': 'No overdue invoices.',
  'Zuletzt gesendet': 'Recently sent',
  'Noch keine Mahnung gesendet.': 'No reminders sent yet.',
  Trockenlauf: 'Dry run',
  'So würde das Mahnwesen jetzt arbeiten – es wurde nichts verschickt oder angelegt.':
    'This is what dunning would do now – nothing was sent or created.',
  ' · Mahnstopp – wird übersprungen': ' · Dunning hold – skipped',
  'Es ist aktuell keine Mahnung fällig.': 'No reminders currently due.',

  // BillingTab
  'Kunden verwalten ihr Abo auf einer eigenen Seite: Zahlungsmethode ändern, Rechnungen ansehen, pausieren, kündigen oder den Tarif wechseln – ohne Login, über einen persönlichen Link. Der Link kommt in den Mahn-E-Mails, im Mitgliederbereich (Abschnitt „Mein Abo“) und von dir per Knopfdruck. Hier legst du pro Abo fest, was erlaubt ist. ':
    'Customers manage their subscription on a dedicated self-service page: update payment method, view invoices, pause, cancel or change plans – without login, via a personal link. The link is included in reminder emails, the customer portal and on demand. Configure allowed actions per subscription here. ',
  'Abos und was Kunden tun dürfen': 'Subscriptions and permitted customer actions',
  Jahr: 'year',
  Monat: 'month',
  'Kündigen erlaubt': 'Cancellation allowed',
  'Pausieren erlaubt': 'Pausing allowed',
  'Kündigung wirkt': 'Cancellation takes effect',
  'zum Ende der bezahlten Zeit': 'at end of billing period',
  sofort: 'immediately',
  'Tarifwechsel erlauben zu': 'Allow plan switch to',
  'Nur andere aktive Abos in derselben Währung.':
    'Only other active subscriptions in the same currency.',
  'Zu den Produkten': 'Go to products',
  'Noch kein Abo-Produkt. Lege ein Produkt mit monatlicher oder jährlicher Zahlung an.':
    'No subscription products yet. Create a product with monthly or annual billing.',

  // SettingsTab
  'Einstellungen gespeichert': 'Settings saved',
  'Auf die Standardwerte zurücksetzen?': 'Reset to default values?',
  Standard: 'Default',
  'Abo- und Raten-Zahlungen': 'Subscription & instalment payments',
  'Was passiert, wenn eine Zahlung nicht durchgeht.':
    'What happens when a payment fails.',
  'Mahnwesen für Abo-Zahlungen aktiv': 'Dunning for subscription payments active',
  'Wiederholte Einzugsversuche': 'Recurring collection retries',
  'Stripe wiederholt selbst (Smart Retries). Stelle Anzahl und Zeitraum im Stripe-Dashboard unter Einstellungen → Abos und E-Mails → Fehlgeschlagene Zahlungen ein.':
    'Stripe retries automatically (Smart Retries). Configure count and interval in Stripe dashboard under Settings → Subscriptions and emails → Failed payments.',
  'HyperLevel zieht die offene Rechnung an den angegebenen Tagen selbst erneut ein. Schalte dann die Stripe-Wiederholungen aus.':
    'HyperLevel retries charging the open invoice automatically on specified days. Disable Stripe retries in that case.',
  'Stripe (Smart Retries)': 'Stripe (Smart Retries)',
  'HyperLevel (eigene Tage)': 'HyperLevel (custom schedule)',
  'Versuche an Tag … nach dem Fehlschlag': 'Retries on day … after failure',
  'Zahlen mit Komma, z. B. 1, 3, 5, 7': 'Comma-separated numbers, e.g. 1, 3, 5, 7',
  'Erinnerungen an Tag … (0 = sofort)': 'Reminders on day … (0 = immediately)',
  'E-Mail mit dem Link zur Abo-Verwaltung. Zahlen mit Komma, z. B. 0, 3, 7':
    'Email with link to subscription portal. Comma-separated numbers, e.g. 0, 3, 7',
  'Zusätzlich per SMS erinnern': 'Also remind via SMS',
  'Zugang pausieren nach … Tagen': 'Pause access after … days',
  '0 = erst wenn Stripe aufgibt': '0 = only when Stripe gives up',
  'Wenn endgültig gescheitert': 'When permanently failed',
  'Zugang behalten': 'Keep access',
  'Abo dann auch bei Stripe kündigen': 'Also cancel subscription in Stripe',
  'Karte aktualisieren über': 'Update card via',
  'HyperLevel-Seite + Stripe Checkout': 'HyperLevel page + Stripe Checkout',
  'Stripe-Kundenportal': 'Stripe customer portal',
  'Link gültig (Tage)': 'Link validity (days)',
  'Texte der E-Mails und SMS': 'Email and SMS copy',
  'Erste Nachricht': 'First notice',
  Erinnerung: 'Reminder',
  'SMS-Text': 'SMS text',
  'Rechnungen: Erinnerung und Mahnungen': 'Invoices: Reminder and dunning levels',
  'Stufen, Gebühren und Verzugszinsen für überfällige Rechnungen.':
    'Levels, fees, and default interest for overdue invoices.',
  Betrieb: 'Operation mode',
  'Start mit Freigabe: nichts geht raus, ohne dass du es gesehen hast.':
    'Start with approval: nothing is sent without your review.',
  Aus: 'Off',
  'Mit Freigabe': 'With approval',
  'Automatisch senden': 'Send automatically',
  'Mindestabstand zwischen zwei Schreiben (Tage)':
    'Minimum gap between reminders (days)',
  'Nur Rechnungen ab (€)': 'Only invoices above (₹)',
  'Kleinbeträge nicht mahnen – zählt der noch offene Betrag':
    'Skip small balances – based on remaining unpaid amount',
  'Zusätzlich per SMS hinweisen': 'Also notify via SMS',
  Stufen: 'Levels',
  Bezeichnung: 'Label',
  'Tage nach Fälligkeit': 'Days overdue',
  'Mahngebühr (€)': 'Dunning fee (₹)',
  'Zahlungsfrist (Tage)': 'Payment deadline (days)',
  'Mahngebühren früherer Schreiben in späteren Mahnungen mitfordern':
    'Include prior reminder fees in subsequent reminders',
  'Die 2. Mahnung nennt dann die noch offene Gebühr der 1. Mahnung und fordert sie mit. Ausschalten, wenn die Gebühr jeder Stufe schon die Summe bis dahin ist.':
    'Subsequent reminders carry over unpaid fees from previous levels. Turn off if fee per level is already cumulative.',
  'Verzugszinsen (§ 288 BGB)': 'Default interest',
  'Verzugszinsen berechnen': 'Calculate default interest',
  'Basiszinssatz (% p. a.)': 'Base interest rate (% p. a.)',
  'Bundesbank – ändert sich am 1. Januar und 1. Juli. Bitte aktuell halten.':
    'Statutory base rate – keep updated according to official reference.',
  'Aufschlag Verbraucher (%)': 'Consumer margin (%)',
  'gesetzlich 5': 'statutory 5%',
  'Aufschlag Unternehmen (%)': 'Commercial / B2B margin (%)',
  'gesetzlich 9': 'statutory 9%',
  'Kunde gilt als': 'Customer classified as',
  'automatisch (Firma am Kontakt = Unternehmen)':
    'automatic (Company on contact = business)',
  'immer Verbraucher': 'always consumer (B2C)',
  'immer Unternehmen': 'always business (B2B)',
  'Zinsen ab Stufe': 'Interest starting from level',
  'Pauschale bei Unternehmen (€)': 'Commercial flat fee (₹)',
  '§ 288 Abs. 5 BGB: 40 €, nur gegenüber Unternehmen':
    'Statutory flat recovery fee for commercial entities',
  'Pauschale ab Stufe': 'Flat fee starting from level',
  'Das ist keine Rechtsberatung. Gebühren und Zinsen müssen zum Vertrag passen; bei Verbrauchern sind Mahngebühren nur in der Höhe der tatsächlichen Kosten zulässig.':
    'This does not constitute legal advice. Dunning fees and interest rates must comply with contractual agreements and local regulations.',
  'Einstellungen speichern': 'Save settings',

  // Main Page
  Mahnwesen: 'Dunning',
  'Zahlungsausfälle bei Abos und Raten auffangen, überfällige Rechnungen freundlich und rechtssicher nachfassen – und Kunden ihr Abo selbst verwalten lassen.':
    'Recover failed subscription and instalment payments, follow up on overdue invoices, and allow customers self-service subscription management.',
  Ratenzahlung: 'Payment plans',
  Zahlungsausfälle: 'Payment failures',
  'Rechnungen{pending}': 'Invoices{pending}',
  'Abo-Verwaltung': 'Subscription management',
};
