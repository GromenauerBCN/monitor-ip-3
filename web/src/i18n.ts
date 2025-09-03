import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ca: { translation: {
    appTitle: "MonitorIP", login: "Entrar", register: "Registrar-se", logout: "Sortir",
    email: "Correu electrònic", password: "Contrasenya",
    targets: "Adreces monitoritzades", addTarget: "Afegir adreça", label: "Etiqueta",
    kind: "Tipus", http: "HTTP/HTTPS", tcp: "TCP", address: "URL o Host", port: "Port",
    interval: "Interval (min)", save: "Desar", delete: "Eliminar", checkNow: "Comprovar ara",
    csvImport: "Importar CSV", chooseFile: "Triar fitxer", upload: "Pujar",
    settings: "Configuració d'avisos", emails: "Correus (separats per coma)",
    daily: "Resum diari per correu", monthly: "Resum mensual per correu",
    telegram: "Telegram", generateToken: "Generar token de connexió",
    telegramHelp: "Envia a @el_teu_bot: /start <TOKEN> per vincular",
    push: "Notificacions mòbil", registerPush: "Registrar dispositiu",
    status: "Estat", lastCheck: "Darrera comprovació", latency: "Latència",
    language: "Idioma",
  }},
  en: { translation: {
    appTitle: "MonitorIP", login: "Login", register: "Register", logout: "Logout",
    email: "Email", password: "Password",
    targets: "Monitored addresses", addTarget: "Add target", label: "Label",
    kind: "Kind", http: "HTTP/HTTPS", tcp: "TCP", address: "URL or Host", port: "Port",
    interval: "Interval (min)", save: "Save", delete: "Delete", checkNow: "Check now",
    csvImport: "CSV Import", chooseFile: "Choose file", upload: "Upload",
    settings: "Alert settings", emails: "Emails (comma separated)",
    daily: "Daily email digest", monthly: "Monthly email digest",
    telegram: "Telegram", generateToken: "Generate connect token",
    telegramHelp: "Send to your bot: /start <TOKEN> to link",
    push: "Mobile push", registerPush: "Register device",
    status: "Status", lastCheck: "Last check", latency: "Latency",
    language: "Language",
  }},
  es: { translation: {
    appTitle: "MonitorIP", login: "Entrar", register: "Registrarse", logout: "Salir",
    email: "Correo", password: "Contraseña",
    targets: "Direcciones monitorizadas", addTarget: "Añadir dirección", label: "Etiqueta",
    kind: "Tipo", http: "HTTP/HTTPS", tcp: "TCP", address: "URL o Host", port: "Puerto",
    interval: "Intervalo (min)", save: "Guardar", delete: "Eliminar", checkNow: "Comprobar ahora",
    csvImport: "Importar CSV", chooseFile: "Elegir archivo", upload: "Subir",
    settings: "Configuración de avisos", emails: "Correos (separados por coma)",
    daily: "Resumen diario por correo", monthly: "Resumen mensual por correo",
    telegram: "Telegram", generateToken: "Generar token de conexión",
    telegramHelp: "Envía a tu bot: /start <TOKEN> para vincular",
    push: "Notificaciones móvil", registerPush: "Registrar dispositivo",
    status: "Estado", lastCheck: "Última comprobación", latency: "Latencia",
    language: "Idioma",
  }},
};

// Add placeholders for requested extra languages (UI will fallback to English for missing keys)
const codes = ["gl","eu","fr","de","it","ru","bg","ro","sr","zh-Hans","ja","hi","id","ar","sw","tsw","mi","qu"];
for (const c of codes) resources[c] = { translation: {} };

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('lang') || 'ca',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
