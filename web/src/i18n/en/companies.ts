export default {
  // Schema & Fields
  Name: 'Name',
  Domain: 'Domain',
  Branche: 'Industry',
  Größe: 'Size',
  Phase: 'Stage',
  Zuständig: 'Owner',
  Telefon: 'Phone',
  Webseite: 'Website',
  Adresse: 'Address',
  PLZ: 'Postal code',
  Ort: 'City',
  Land: 'Country',
  Beschreibung: 'Description',
  Kontakte: 'Contacts',
  Deals: 'Deals',
  'Deal-Wert': 'Deal value',
  Angelegt: 'Created',
  Geändert: 'Updated',

  // Lifecycle
  'Muster GmbH': 'Acme Corp',
  'Name;Domain;Branche': 'Name;Domain;Industry',
  Lead: 'Lead',
  MQL: 'MQL',
  SQL: 'SQL',
  Opportunity: 'Opportunity',
  Kunde: 'Customer',
  Andere: 'Other',

  // Actions & Modals
  'Neue Firma': 'New company',
  'Name *': 'Name *',
  'Kontakte mit dieser E-Mail-Domain werden verknüpft': 'Contacts with this email domain will be linked',
  Speichern: 'Save',
  'Firma angelegt': 'Company created',
  'Gibt es schon ({domain}) – aktualisiert': 'Already exists ({domain}) – updated',
  'Firmen-Einstellungen': 'Company settings',
  Gespeichert: 'Saved',
  'Kontakte automatisch per E-Mail-Domain mit Firmen verknüpfen (nie bei Freemail wie gmail.com, web.de)':
    'Automatically link contacts to companies by email domain (never for freemail like gmail.com)',
  'Für unbekannte Firmen-Domains automatisch eine Firma anlegen': 'Automatically create a company for unknown company domains',
  'Aus dem Feld „Firma“ am Kontakt eine Firma anlegen und als primäre verknüpfen':
    'Create a company from the contact’s “Company” field and link as primary',
  'Das Feld „Firma“ am Kontakt zeigt immer den Namen der primären Firma – ändert man es, wird die passende Firma primär.':
    'The “Company” field on the contact always shows the name of the primary company – changing it updates the primary company.',
  'Alle Kontakte jetzt abgleichen': 'Sync all contacts now',
  '{contacts} Kontakte geprüft · {companies} Firmen': '{contacts} contacts checked · {companies} companies',

  // Main Page
  Firmen: 'Companies',
  '{n} Firmen': '{n} companies',
  Einstellungen: 'Settings',
  Import: 'Import',
  Export: 'Export',
  '+ Firma': '+ Company',
  'Name, Domain, Ort, Branche…': 'Name, domain, city, industry…',
  Filter: 'Filter',
  Spalten: 'Columns',
  'Erste Firma anlegen': 'Create first company',
  'Keine Firma passt zu Suche und Filter.': 'No company matches search and filter.',
  'Noch keine Firmen. Kontakte mit Firmenname oder Firmen-E-Mail werden automatisch zugeordnet.':
    'No companies yet. Contacts with company name or company email are automatically linked.',
  'Firmen importieren (CSV)': 'Import companies (CSV)',
  'Kopfzeile mit z. B. Name, Domain, Branche, Größe, Telefon, Webseite, Ort – eigene Eigenschaften über ihren Namen. Gleiche Domain (sonst gleicher Name) wird aktualisiert statt doppelt angelegt.':
    'Header with e.g. name, domain, industry, size, phone, website, city – custom properties by their name. Matching domain (or name) will update instead of duplicate.',

  // Merge Modal
  'Firmen zusammenführen': 'Merge companies',
  'Die gewählte Firma wird in {name} übernommen: Kontakte, Deals, Notizen und leere Felder wandern hierher, danach wird sie gelöscht.':
    'The selected company will be merged into {name}: contacts, deals, notes, and blank fields move here, then it is deleted.',
  'Firma suchen…': 'Search company…',
  '„{from}“ in „{to}“ zusammenführen?': 'Merge “{from}” into “{to}”?',
  Zusammengeführt: 'Merged',
  '{count} Kontakte': '{count} contacts',
  'Keine andere Firma gefunden.': 'No other company found.',

  // Detail Page
  '← Firmen': '← Companies',
  Zusammenführen: 'Merge',
  Löschen: 'Delete',
  'Firma löschen? Kontakte und Deals bleiben erhalten.': 'Delete company? Contacts and deals remain intact.',
  Gelöscht: 'Deleted',
  '{count} Deals, ohne verlorene': '{count} deals, excluding lost',
  'Offene Aufgaben': 'Open tasks',
  Eigenschaften: 'Properties',
  Aktivität: 'Activity',
  'Notizen ({count})': 'Notes ({count})',
  'Aufgaben ({count})': 'Tasks ({count})',
  'Änderungen der Firma und die Aktivität aller verknüpften Kontakte.':
    'Changes to the company and activity of all associated contacts.',
  'Neue Aufgabe zur Firma': 'New task for company',
  'Fällig am': 'Due on',
  'Aufgabe anlegen': 'Create task',
  'bis {date}': 'due {date}',
  'Offene Aufgaben der Kontakte': 'Open contact tasks',
  'Keine Aufgaben.': 'No tasks.',
  'Kontakte, Deals & mehr': 'Contacts, deals & more',
  'Angelegt {date}': 'Created {date}',
  'Quelle: {source}': 'Source: {source}',
};
