import type { Catalog } from '../registry';

export default {
  // CogneeKit.tsx
  'Zugriffskontrolle an': 'Access control enabled',
  'Server ohne Anmeldung!': 'Server without authentication!',
  'Zugriffskontrolle nicht geprüft': 'Access control not verified',
  'Daten in Cognee löschen?': 'Delete data in Cognee?',
  Später: 'Later',
  'Jetzt in Cognee löschen': 'Delete in Cognee now',
  'Löschung angestoßen ({count} {item})': 'Deletion queued ({count} {item})',
  Eintrag: 'entry',
  Einträge: 'entries',
  'Die Freigabe ist beendet – es wird nichts mehr übertragen. Die bereits übertragenen Daten liegen aber noch auf dem Cognee-Server:':
    'Sharing has ended – no new data will be synced. However, previously synced data remains on the Cognee server:',
  '„Jetzt löschen“ entfernt diese Daten dort endgültig (das jeweilige Dataset mit Wissensgraph und Vektoren). In HyperLevel bleibt alles unverändert. Bei „Später“ bleiben sie in Cognee, bis du sie über „Status“ löschst.':
    '"Delete now" permanently removes these datasets, knowledge graphs, and embeddings from Cognee. Your CRM data in HyperLevel remains unchanged. With "Later", they stay in Cognee until purged via Status.',

  // CogneeSettings.tsx
  'Wissensgedächtnis (Cognee)': 'Knowledge Memory (Cognee)',
  'Ein Wissensgraph aus dem, was dieser Sub-Account freigibt – zum Fragen („Wie läuft unser Onboarding ab?“), für den KI-Agenten und für MCP-Clients wie Claude. Es wird nur geteilt, was du unten ausdrücklich einschaltest; Standard ist':
    'A knowledge graph generated from what this sub-account shares – for natural-language Q&A ("How does our onboarding process work?"), AI assistants, and MCP clients like Claude. Only explicitly enabled items below are synced; default is',
  aus: 'disabled',
  'Die Daten liegen auf dem Cognee-Server der Agentur, getrennt in eigenen Datasets dieses Sub-Accounts. Alles, was gesendet, durchsucht oder gelöscht wird, steht im Protokoll (nur Anzahlen, nie Inhalte).':
    'Data resides on the agency Cognee server, strictly isolated in sub-account datasets. All sync, search, and purge operations are audited (record counts only, never content).',
  'Die Agentur hat den Cognee-Server noch nicht eingerichtet.': 'The agency has not configured the Cognee server yet.',
  'Jetzt einrichten': 'Set up now',
  'Bitte dort nachfragen – bis dahin wird nichts übertragen.': 'Please check with your agency admin – no data will be synced until configured.',
  'Gedächtnis fragen': 'Query memory',
  'Frage oder Stichworte, z. B. Wie läuft der Onboarding-Call ab?': 'Question or keywords, e.g. What is the process for onboarding calls?',
  'Frage an das Gedächtnis': 'Question for knowledge memory',
  'Sucht …': 'Searching …',
  Fragen: 'Ask',
  'Antwort formulieren lassen (nutzt das Sprachmodell des Cognee-Servers und kann dort Kosten verursachen)':
    'Generate synthesized answer (uses the Cognee server LLM and may incur API usage)',
  'Durchsucht: {types}. Du siehst nur Treffer aus Bereichen, auf die du Zugriff hast.':
    'Searching across: {types}. You only see matches from areas you have permission to view.',
  'Keine Treffer.': 'No matches found.',
  'Was geteilt wird': 'What is shared',
  'Wissensgedächtnis für diesen Sub-Account einschalten': 'Enable knowledge memory for this sub-account',
  'Die Agentur schaltet das Gedächtnis selbst ein – frag dort nach.': 'The agency manages memory enablement – please contact your agency administrator.',
  personenbezogen: 'personal data',
  '{count} in Cognee': '{count} in Cognee',
  'E-Mail-Adressen, Telefonnummern und IBANs vor dem Senden schwärzen': 'Redact email addresses, phone numbers, and bank/tax identifiers before sync',
  'Mitglieder (Kunden-Logins) dürfen das Gedächtnis befragen – nur zu Bereichen, auf die sie Zugriff haben':
    'Client portal members may query memory – strictly restricted to items they have permission to access',
  'Personenbezogene Daten werden geteilt: {types}. Auftragsverarbeitung und Rechtsgrundlage sollten geklärt sein. Wird eine Person nach DSGVO gelöscht, löscht HyperLevel ihre Daten auch in Cognee.':
    'Personal data is shared: {types}. Ensure data processing agreements and lawful grounds are in place. When a contact is deleted under data privacy regulations, HyperLevel purges their records in Cognee as well.',
  'Das Schwärzen ist eine Sicherung, keine Anonymisierung: Namen und Freitext bleiben. Wer die Schwärzung später ein- oder ausschaltet, schickt alles Betroffene neu und ersetzt die alte Fassung.':
    'Redaction is a safeguard, not total anonymization: names and unstructured text remain. Toggling redaction later triggers a full re-sync to replace existing datasets.',
  Speichern: 'Save',
  Gespeichert: 'Saved',

  // phaseBadge
  'aus – Daten liegen noch in Cognee': 'disabled – datasets remain in Cognee',
  Fehler: 'Error',
  'Wissensgraph wird gebaut': 'Building knowledge graph',
  wartet: 'waiting',
  aktuell: 'up to date',
  'wartet auf den ersten Abgleich': 'waiting for initial sync',

  // Actions
  Gesendet: 'Sent',
  Befragt: 'Queried',
  Gelöscht: 'Deleted',
  DSGVO: 'GDPR / Privacy',
  'Löschen angestoßen': 'Deletion queued',
  Freigaben: 'Permissions',
  Gemerkt: 'Remembered',
  Vergessen: 'Forgotten',
  Abgleich: 'Sync',

  // Status
  Status: 'Status',
  'geprüft {date}': 'verified {date}',
  Daten: 'Data',
  Zustand: 'State',
  'Dataset in Cognee': 'Dataset in Cognee',
  geschwärzt: 'redacted',
  'nächster Versuch {date}': 'next retry {date}',
  '{count} Eintrag/Einträge von Cognee abgelehnt': '{count} record(s) rejected by Cognee',
  'Jetzt abgleichen': 'Sync now',
  'Abgleich gestartet': 'Sync started',
  'Schaut jeden Datensatz noch einmal an – Unverändertes kostet nichts': 'Re-evaluates every record – unchanged items incur zero compute cost',
  'Alles neu abgleichen': 'Full re-sync',
  'Alles neu abgleichen? Jeder freigegebene Datensatz wird noch einmal geprüft; nur Geändertes wird gesendet.':
    'Trigger full re-sync? Every shared record is re-checked; only updated records will be transferred.',
  'Voller Abgleich gestartet': 'Full sync started',
  'Daten in Cognee löschen …': 'Purge data in Cognee …',
  '{count} Löschung(en) werden an Cognee gesendet (bei Fehlern wiederholt HyperLevel sie automatisch).':
    '{count} deletion(s) being dispatched to Cognee (automatically retried on error).',
  'Noch in Cognee, aber nicht mehr freigegeben: {types}.': 'Still stored in Cognee but no longer shared: {types}.',
  'Letzte Vorgänge': 'Recent operations',
  'Noch nichts. Das ganze Protokoll steht unter Einstellungen → API & Webhooks bzw. Agentur → Protokoll (Aktionen „cognee.…“).':
    'No activity yet. Complete audit history is available in Settings → API & Webhooks or Agency → Audit Log ("cognee.*" actions).',

  // Memories
  'Gemerkte Hinweise': 'Stored knowledge & notes',
  'Was hier steht, landet im Gedächtnis und kann gefunden werden – auch vom KI-Agenten (Tool „ghl_memory_remember“). Keine Passwörter oder Zugangsdaten eintragen.':
    'Content saved here is indexed into memory and retrievable by AI agents (tool "ghl_memory_remember"). Do not enter passwords or sensitive credentials.',
  'Neuer Hinweis': 'New note / instruction',
  'z. B. Rechnungen gehen immer an die Buchhaltung, nie an die Geschäftsleitung.':
    'e.g. Invoices are always routed to billing/accounts team, never to executive management.',
  Merken: 'Remember',
  'im Gedächtnis': 'indexed in memory',
  'wird übertragen': 'syncing',
  'Diesen Hinweis löschen? Er wird auch in Cognee entfernt.': 'Delete this note? It will also be purged from Cognee.',
  Löschen: 'Delete',

  // CogneeAgency.tsx
  'Verbindet HyperLevel mit einem selbst gehosteten': 'Connects HyperLevel to a self-hosted',
  '-Server (Wissensgraph, Apache-2.0) über dessen REST-Schnittstelle. Jeder Sub-Account entscheidet selbst, ob und welche Daten er teilt – Standard: aus. Jeder Sub-Account bekommt eigene Datasets (':
    ' server (knowledge graph, Apache-2.0) via its REST API. Each sub-account controls what it shares – default: disabled. Each sub-account is assigned dedicated datasets (',
  '), andere Datasets werden nie gelesen oder beschrieben. Einrichtung, Server-Einstellungen und was gesendet wird:':
    '); foreign datasets are never accessed or modified. Setup guide, server configuration, and payload specs:',
  'Auf dem Cognee-Server muss': 'On the Cognee server,',
  'gesetzt sein, und HyperLevel sollte einen eigenen Cognee-Nutzer bekommen – so liegt jedes Dataset getrennt.':
    'must be enabled, and HyperLevel should use a dedicated service account to guarantee dataset isolation.',
  'Der Cognee-Server antwortet ohne Anmeldung – die Zugriffskontrolle ist aus. Es wird nichts übertragen, bis':
    'The Cognee server accepts unauthenticated requests – access control is disabled. No data will be synced until',
  'gesetzt ist.': 'is set.',
  'Adresse des Cognee-Servers': 'Cognee server URL',
  'z. B. https://cognee.example.com – oder http://cognee:8000 im selben Docker-Netz. Ohne http:// nur im eigenen Netz.':
    'e.g. https://cognee.example.com – or http://cognee:8000 on the same Docker network. Hostname only allowed for internal networks.',
  Anmeldung: 'Authentication',
  'E-Mail und Passwort (Cognee-Nutzer für HyperLevel)': 'Email and password (dedicated Cognee user for HyperLevel)',
  'API-Schlüssel (Cognee → /api/v1/auth/api-keys)': 'API key (Cognee → /api/v1/auth/api-keys)',
  'E-Mail des Cognee-Nutzers': 'Cognee user email',
  Passwort: 'Password',
  'API-Schlüssel': 'API key',
  'Wird verschlüsselt gespeichert und nie wieder angezeigt. Leer lassen = bisherigen Wert behalten.':
    'Stored securely with encryption and never revealed. Leave empty to preserve current value.',
  'Internes Netz erlauben (Cognee läuft im selben Docker-Netz oder LAN)': 'Allow private network addresses (Cognee runs on Docker network or LAN)',
  ' – vermutlich nötig': ' – likely required',
  'Sub-Account-Admins dürfen das Gedächtnis selbst einschalten (aus: nur die Agentur)':
    'Sub-account admins may enable memory themselves (disabled: agency approval only)',
  'Weitere Einstellungen': 'Advanced settings',
  'Auch an einen Server ohne Zugriffskontrolle senden (nicht empfohlen – Sub-Accounts liegen dort nicht getrennt)':
    'Allow sending to servers without access control (not recommended – sub-accounts will not be isolated)',
  'Speichern & testen': 'Save & test',
  'Verbindung testen': 'Test connection',
  Entfernen: 'Disconnect',
  'Verbindung zu Cognee entfernen? Das geht nur, wenn kein Sub-Account mehr Daten teilt oder in Cognee liegen hat.':
    'Disconnect Cognee integration? Only permitted when no sub-accounts are actively syncing or have residual data in Cognee.',
  Entfernt: 'Disconnected',
  'Trotzdem entfernen? Die Daten bleiben dann auf dem Server und lassen sich über HyperLevel nicht mehr löschen.':
    'Disconnect anyway? Stored datasets will remain on the Cognee server and can no longer be managed via HyperLevel.',
  'Letzter Test {date}:': 'Last test {date}:',
  ok: 'OK',
  fehlgeschlagen: 'failed',
  unklar: 'inconclusive',
  'Verbunden{version}. Sub-Accounts können das Gedächtnis jetzt unter Einstellungen → Gedächtnis einschalten.':
    'Connected{version}. Sub-accounts can now enable Knowledge Memory under Settings → Memory.',
  'mit Cognee': 'with Cognee',
  'Sub-Accounts im Überblick': 'Sub-accounts overview',
  '{active} von {total} Sub-Accounts teilen Daten. Eingeschaltet wird in den Einstellungen des Sub-Accounts (Reiter „Gedächtnis“); hier siehst du den Stand und kannst ausschalten.':
    '{active} of {total} sub-accounts are sharing data. Activated within sub-account Settings (Memory tab); monitor status or revoke access here.',
  'Sub-Account': 'Sub-account',
  Freigabe: 'Sharing',
  'Letzter Abgleich': 'Last sync',
  Zugang: 'Credentials',
  an: 'active',
  '{count} Datentyp/Datentypen': '{count} data type(s)',
  '{count} Fehler': '{count} error(s)',
  '{count} Löschung(en) offen': '{count} deletion(s) pending',
  Cognee: 'Cognee',
  'gh_<ID>_<Typ>': 'gh_<ID>_<Type>',
  'ENABLE_BACKEND_ACCESS_CONTROL=true': 'ENABLE_BACKEND_ACCESS_CONTROL=true',
  'eigener: {label}': 'custom: {label}',
  'Agentur-Zugang': 'Agency credentials',
  Ausschalten: 'Disable',
  'Teilen für „{name}“ ausschalten? Es wird nichts mehr übertragen; die vorhandenen Daten in Cognee kannst du danach löschen.':
    'Disable sharing for "{name}"? Sync will halt immediately; existing datasets in Cognee can be purged subsequently.',
  Ausgeschaltet: 'Disabled',
  'Daten löschen …': 'Purge data …',
  'Einstellungen → Gedächtnis dieses Sub-Accounts': 'Settings → Memory for this sub-account',
  'Cognee-Zugang für {name}': 'Cognee credentials for {name}',
  'Eigenen Zugang entfernen': 'Remove custom credentials',
  'Zugang entfernt': 'Credentials removed',
  'Standard ist der Zugang der Agentur (ein Cognee-Nutzer für alle). Mit einem eigenen Cognee-Nutzer für diesen Sub-Account gehören seine Datasets diesem Nutzer – die Trennung gilt dann auch in Cognee selbst. Wechseln geht nur, solange in Cognee noch keine Daten dieses Sub-Accounts liegen.':
    'By default, the agency credentials are used (shared user across accounts). Providing dedicated Cognee credentials assigns ownership of all datasets to that user for complete multi-tenant isolation. Switching is only permitted before initial sync.',
  'Jetzt:': 'Current:',
  'eigener Zugang ({label})': 'custom credentials ({label})',
  'Zugang der Agentur': 'agency credentials',
  'E-Mail und Passwort': 'Email and password',
} satisfies Catalog;
