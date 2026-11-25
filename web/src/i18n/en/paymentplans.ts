export default {
  // Common / ON_DEFAULT
  'Zugang pausieren (kommt zurück, sobald bezahlt wird)':
    'Pause access (restored once paid)',
  'Zugang entziehen': 'Revoke access',
  'Zugang behalten (nur benachrichtigen)': 'Keep access (notify only)',

  // FILTERS
  'Alle Käufe': 'All purchases',
  Laufend: 'Active',
  Ausgefallen: 'Defaulted',
  Abgeschlossen: 'Completed',
  Beendet: 'Ended',

  // every helper
  wöchentlich: 'weekly',
  'alle {n} Wochen': 'every {n} weeks',
  monatlich: 'monthly',
  jährlich: 'yearly',
  'alle {n} Monate': 'every {n} months',

  // PlanDialog
  'Bitte ein Produkt wählen.': 'Please select a product.',
  'Raten: 2 bis 60.': 'Installments: 2 to 60.',
  'Abstand: 1 bis 52 Wochen.': 'Interval: 1 to 52 weeks.',
  'Abstand: 1 bis 12 Monate.': 'Interval: 1 to 12 months.',
  'Rate: mindestens 0,50 €.': 'Installment: at least ₹0.50 / 0.50 €.',
  'Erste Rate: mindestens 0,50 € – oder leer lassen.':
    'First installment: at least ₹0.50 / 0.50 € – or leave blank.',
  'Plan gespeichert': 'Plan saved',
  'Ratenplan bearbeiten': 'Edit payment plan',
  'Neuer Ratenplan': 'New payment plan',
  Abbrechen: 'Cancel',
  Speichern: 'Save',
  'Bestehende Käufe behalten die Bedingungen, zu denen sie gekauft wurden. Die Änderung gilt für neue Käufe.':
    'Existing purchases retain their agreed terms. Changes apply to new purchases.',
  'Produkt *': 'Product *',
  'Ratenzahlung gibt es für Einmal-Produkte, nicht für Abos.':
    'Payment plans are available for one-time products, not for subscriptions.',
  'Name (optional)': 'Name (optional)',
  'Erscheint auf der Kaufseite statt der Standard-Beschreibung, z. B. „Bequem in 3 Raten“.':
    'Shown on the checkout page instead of the default description, e.g. “Convenient in 3 installments”.',
  'Anzahl Raten *': 'Number of installments *',
  'Betrag je Rate (brutto) *': 'Amount per installment (gross) *',
  Abstand: 'Interval',
  Einheit: 'Unit',
  'Monat(e)': 'Month(s)',
  'Woche(n)': 'Week(s)',
  'Erste Rate abweichend (optional)': 'Different first installment (optional)',
  'Zum Beispiel eine höhere Anzahlung. Leer = alle Raten gleich.':
    'For example, a higher deposit. Blank = all installments equal.',
  'Wenn eine Rate nicht eingezogen werden kann':
    'If an installment cannot be collected',
  'Auf der Kaufseite anbieten': 'Offer on checkout page',
  'insgesamt {total}': 'total {total}',
  'Achtung: Die Summe liegt unter dem Preis des Produkts ({price}).':
    'Warning: Total is less than product price ({price}).',
  'Die Summe liegt über dem Einmalpreis ({price}) – ein Ratenaufschlag. Das ist erlaubt, muss aber auf der Kaufseite klar erkennbar sein.':
    'Total exceeds the one-time price ({price}) – an installment surcharge. This is permitted but must be clearly indicated at checkout.',

  // PurchaseDialog
  Ratenkauf: 'Installment purchase',
  'Zugang fortgesetzt': 'Access resumed',
  'Zugang pausiert': 'Access paused',
  'Den Ratenplan beenden? Stripe bucht dann keine weiteren Raten ab (bisher bezahlt: {paid} von {installments}).':
    'Cancel payment plan? Stripe will not charge any further installments (paid so far: {paid} of {installments}).',
  'Ratenplan beendet': 'Payment plan ended',
  'Zugang pausieren': 'Pause access',
  'Zugang fortsetzen': 'Resume access',
  'Plan beenden': 'End plan',
  Kontakt: 'Contact',
  'Kontakt öffnen': 'Open contact',
  'noch nicht zugeordnet': 'not yet assigned',
  Produkt: 'Product',
  Plan: 'Plan',
  Status: 'Status',
  Zugang: 'Access',
  Bezahlt: 'Paid',
  '{paid} von {total} Raten · {paidMoney} von {totalMoney}':
    '{paid} of {total} installments · {paidMoney} of {totalMoney}',
  Offen: 'Unpaid',
  Gestartet: 'Started',
  Fehlversuche: 'Failed attempts',
  '{count} (zuletzt {date})': '{count} (last {date})',
  Grund: 'Reason',
  'Bezahlte Raten': 'Paid installments',
  Rate: 'Installment',
  Betrag: 'Amount',
  'Bezahlt am': 'Paid on',
  Rechnung: 'Invoice',
  'Beleg öffnen': 'Open invoice',
  'Noch keine Rate bezahlt.': 'No installments paid yet.',
  'Offene Aufgaben im Hintergrund': 'Background tasks pending',
  'Ende nach der letzten Rate bei Stripe setzen':
    'Schedule termination after final installment in Stripe',
  'Versuch {attempts}, nächster {date}':
    'Attempt {attempts}, next {date}',

  // Main Page
  'Den Plan „{name}“ löschen? Bestehende Käufe laufen mit ihren Bedingungen weiter.':
    'Delete plan “{name}”? Existing purchases continue under their current terms.',
  'Plan gelöscht': 'Plan deleted',
  Ratenzahlung: 'Payment Plans',
  'Kunden zahlen in Raten – Stripe zieht ein und hört nach der letzten Rate von selbst auf. Der Zugang folgt der Zahlung.':
    'Customers pay in installments – Stripe collects payments and stops automatically after the final installment. Access follows payment status.',
  'Stripe ist noch nicht verbunden.': 'Stripe is not yet connected.',
  'Ratenzahlung läuft über Stripe-Abos – trage unter ':
    'Payment plans run via Stripe subscriptions – configure your key under ',
  ' deinen Schlüssel ein und richte den Webhook ein (siehe Anleitung).':
    ' and configure the webhook (see documentation).',
  'Einstellungen → Stripe': 'Settings → Stripe',
  'Laufende Käufe': 'Active purchases',
  'Zahlung klären': 'Resolve payment',
  'Noch offen (laufend + ausgefallen)': 'Unpaid balance (active + defaulted)',
  Käufe: 'Purchases',
  Pläne: 'Plans',
  Ratenkäufe: 'Installment purchases',
  'Wer zahlt wie weit? Ein Klick zeigt die bezahlten Raten.':
    'Track payment progress. Click any purchase to view installments.',
  'Kontakt noch offen': 'Contact pending',
  '{label} · {paid} von {installments} Raten bezahlt ({money}) · seit {date}':
    '{label} · {paid} of {installments} installments paid ({money}) · since {date}',
  'Keine Käufe mit diesem Status.': 'No purchases with this status.',
  'Noch kein Kauf mit Ratenzahlung. Lege einen Plan an – er erscheint dann auf der Kaufseite des Produkts.':
    'No installment purchases yet. Create a plan to make it available on the product checkout page.',
  'Noch kein Einmal-Produkt': 'No one-time products yet',
  'Zu den Produkten': 'Go to products',
  'Ratenzahlung gibt es für Produkte mit Einmalpreis. Lege zuerst eines an.':
    'Payment plans require one-time products. Create one first.',
  'Einmalpreis {price}': 'One-time price {price}',
  ' + {rate} % USt.': ' + {rate}% GST/tax',
  '+ Plan': '+ Plan',
  aus: 'off',
  Löschen: 'Delete',
  'insgesamt {total} · {running} laufend · {completed} abgeschlossen · {defaulted} ausgefallen':
    'total {total} · {running} active · {completed} completed · {defaulted} defaulted',
  'Noch kein Plan – Kunden zahlen einmalig.':
    'No plans yet – customers pay one-time.',
};
