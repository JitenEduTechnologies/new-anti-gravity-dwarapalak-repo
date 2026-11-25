export default {
  // Types
  Text: 'Text',
  'Mehrzeiliger Text': 'Multiline text',
  Zahl: 'Number',
  'Währung (€)': 'Currency (₹)',
  Datum: 'Date',
  'Datum & Uhrzeit': 'Date & time',
  Auswahl: 'Dropdown',
  Mehrfachauswahl: 'Multiselect',
  Checkbox: 'Checkbox',
  URL: 'URL',
  'E-Mail': 'Email',
  Telefon: 'Phone',
  Nutzer: 'User',
  Datei: 'File',

  // System & Field labels
  Zuständig: 'Owner',
  Angelegt: 'Created',
  Geändert: 'Updated',
  Firma: 'Company',

  // Prop row editor
  'Bezeichnung, z. B. Kennzeichen': 'Label, e.g. License plate',
  'Optionen, mit Komma': 'Options, comma-separated',
  Pflicht: 'Required',
  Eindeutig: 'Unique',
  'Eigenschaft entfernen': 'Remove property',

  // Builder Modal
  '{plural} bearbeiten': 'Edit {plural}',
  'Neues Objekt': 'New object',
  'Objekt „{plural}“ mit allen {records} Datensätzen löschen?':
    'Delete object “{plural}” with all {records} records?',
  Gelöscht: 'Deleted',
  Löschen: 'Delete',
  Speichern: 'Save',
  'Objekt anlegen': 'Create object',
  'Name (Einzahl) *': 'Name (singular) *',
  Fahrzeug: 'Vehicle',
  'Name (Mehrzahl)': 'Name (plural)',
  Fahrzeuge: 'Vehicles',
  Beschreibung: 'Description',
  'Wofür ist das Objekt da?': 'What is this object used for?',
  'Anzeige-Eigenschaft': 'Display property',
  'Name eines Datensatzes in Listen und Verknüpfungen':
    'Name of a record in lists and associations',
  Name: 'Name',
  'Eindeutig (z. B. Kennzeichen)': 'Unique (e.g. License plate)',
  'Text, E-Mail, Telefon, URL, Zahl oder Datum': 'Text, email, phone, URL, number or date',
  Symbol: 'Icon',
  'Symbol {name}': 'Icon {name}',
  Eigenschaften: 'Properties',
  Anzeige: 'Display',
  eindeutig: 'unique',
  '+ Eigenschaft': '+ Property',
  'Eigenschaften verwalten →': 'Manage properties →',
  'Gruppen, Beschreibungen und Änderungen: ': 'Groups, descriptions and changes: ',
  'Die Anzeige-Eigenschaft ({primary}) gibt es immer. Weitere jetzt oder später unter Eigenschaften.':
    'The display property ({primary}) is always present. Add more now or later under properties.',
  '+ Weitere Eigenschaft': '+ Another property',
  'Angelegt – nicht übernommen: {errors}': 'Created – not applied: {errors}',
  '{plural} angelegt': '{plural} created',
  'Eigenschaft angelegt': 'Property created',
  Gespeichert: 'Saved',

  // ObjectsHome
  Objekte: 'Objects',
  'Eigene Datensatz-Typen neben Kontakten, Firmen und Deals – z. B. Fahrzeuge, Verträge, Immobilien':
    'Custom record types alongside contacts, companies and deals – e.g. vehicles, contracts, real estate',
  '+ Objekt': '+ Object',
  Kontakte: 'Contacts',
  Firmen: 'Companies',
  Deals: 'Deals',
  'Standard-Objekt': 'Standard object',
  '{records} Datensätze · {properties} Eigenschaften':
    '{records} records · {properties} properties',
  'Name, Symbol und Eigenschaften festlegen': 'Set name, icon and properties',

  // NewRecord
  '{singular} anlegen': 'Create {singular}',
  '{singular} angelegt': '{singular} created',
  'Gab es schon – aktualisiert': 'Already existed – updated',

  // RecordsList
  'Objekt nicht gefunden.': 'Object not found.',
  'ohne Namen': 'unnamed',
  '{total} Datensätze': '{total} records',
  '← Objekte': '← Objects',
  Objekt: 'Object',
  Import: 'Import',
  Export: 'Export',
  '+ {singular}': '+ {singular}',
  '{plural} durchsuchen…': 'Search {plural}…',
  Filter: 'Filter',
  Spalten: 'Columns',
  'Nichts passt zu Suche und Filter.': 'Nothing matches search and filters.',
  'Noch keine {plural}.': 'No {plural} yet.',
  '{plural} importieren (CSV)': 'Import {plural} (CSV)',
  'Kopfzeile mit den Namen der Eigenschaften ({labels}). Gleiche Werte in eindeutigen Eigenschaften aktualisieren statt doppelt anzulegen.':
    'Header row with property names ({labels}). Matching values in unique properties update rather than duplicate.',

  // RecordPage
  '{singular} ohne Namen': 'Unnamed {singular}',
  '{singular} · angelegt {created} · geändert {updated}':
    '{singular} · created {created} · updated {updated}',
  '← {plural}': '← {plural}',
  '{singular} löschen? Verknüpfungen und Notizen werden mit gelöscht.':
    'Delete {singular}? Associations and notes will also be deleted.',
  Aktivität: 'Activity',
  'Notizen ({count})': 'Notes ({count})',

  // Trigger filters & Steps
  'Label der Verknüpfung (optional)': 'Association label (optional)',
  'jedes eigene Objekt': 'any custom object',
  jede: 'any',
  'Eigenschaft': 'Property',
  'Neuer Wert (leer = jeder)': 'New value (empty = any)',
  'z. B. customer': 'e.g. customer',
  'Nur Kontakte mit diesem Label': 'Only contacts with this label',
  'Nur Kontakte, deren primäre Firma es ist': 'Only contacts whose primary company it is',
  'Der Workflow startet für die mit dem Datensatz verknüpften Kontakte. Platzhalter: {placeholders}.':
    'The workflow triggers for contacts associated with the record. Placeholders: {placeholders}.',
  'Wert oder {{contact.…}}': 'Value or {{contact.…}}',
  Entfernen: 'Remove',
  'wählen…': 'select…',
  'Welcher Datensatz': 'Which record',
  'Der Datensatz aus dem Auslöser': 'The record from the trigger',
  'Alle mit dem Kontakt verknüpften': 'All associated with the contact',
  'Die primäre Firma des Kontakts': 'The primary company of the contact',
  'Nur mit Label (optional)': 'Only with label (optional)',
  Werte: 'Values',
  'Neue Werte': 'New values',
  'Gleiche Domain = vorhandene Firma wird aktualisiert':
    'Matching domain = existing company updated',
  'Eindeutige Eigenschaften verhindern Dubletten': 'Unique properties prevent duplicates',
  'Datensatz finden': 'Find record',
  'Über eine Eigenschaft': 'Via a property',
  'ist gleich': 'equals',
  'E-Mail-Adressen werden zur Domain': 'Email addresses will be converted to domain',
  'Anlegen, wenn keiner passt': 'Create if none matches',
  'Mit dem Kontakt verknüpfen': 'Associate with contact',
  'Als primäre Firma des Kontakts': 'As primary company of contact',
};
