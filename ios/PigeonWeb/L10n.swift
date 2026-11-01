import Foundation

/// The app's text in the same six languages as the desktop browser.
enum L10n {
    static let languages: [(code: String, name: String)] = [
        ("en", "English"), ("pl", "Polski"), ("de", "Deutsch"), ("es", "Español"), ("fr", "Français"), ("pt", "Português")
    ]

    /// "auto" follows the phone's language, falling back to English.
    static func resolve(_ preference: String) -> String {
        if preference != "auto", strings[preference] != nil { return preference }
        for code in Locale.preferredLanguages {
            let short = String(code.prefix(2)).lowercased()
            if strings[short] != nil { return short }
        }
        return "en"
    }

    static func text(_ key: String, lang: String, vars: [String: String] = [:]) -> String {
        var s = strings[lang]?[key] ?? strings["en"]?[key] ?? key
        for (k, v) in vars { s = s.replacingOccurrences(of: "{\(k)}", with: v) }
        return s
    }

    static let strings: [String: [String: String]] = [
        "en": [
            "newTab": "New Tab", "newTabButton": "New tab", "searchPlaceholder": "Search or enter address",
            "searchWith": "Search with {engine} or type a URL", "tabs": "Tabs", "done": "Done", "closeAll": "Close all",
            "bookmarks": "Bookmarks", "history": "History", "settings": "Settings", "menu": "Menu",
            "addBookmark": "Add bookmark", "removeBookmark": "Remove bookmark", "share": "Share",
            "searchEngine": "Search engine", "blockTrackers": "Block trackers & ads",
            "blockTrackersInfo": "Ads and trackers from {n} networks are stopped before they load.",
            "gooseMode": "Goose mode (Goose Web)", "language": "Language", "systemDefault": "System default",
            "joinDiscord": "Join our Discord", "about": "About {name}", "version": "Version {v}",
            "aboutText": "A fast, private browser. On iPhone it runs on Apple’s WebKit engine, like every iOS browser.",
            "checkUpdates": "Check for updates", "noBookmarks": "No bookmarks yet. Tap the ☆ in the menu to save a page.",
            "noHistory": "Nowhere flown yet.", "clearHistory": "Clear history", "addShortcut": "Add shortcut",
            "name": "Name", "webAddress": "Web address", "add": "Add", "cancel": "Cancel", "delete": "Delete",
            "invalidAddress": "That doesn’t look like a web address.",
            "greetMorning": "Good morning", "greetAfternoon": "Good afternoon", "greetEvening": "Good evening",
            "greetNight": "Up late? So are the {birds}", "pigeons": "pigeons", "geese": "geese", "honk": "Honk!",
            "today": "Today", "earlier": "Earlier"
        ],
        "pl": [
            "newTab": "Nowa karta", "newTabButton": "Nowa karta", "searchPlaceholder": "Szukaj lub wpisz adres",
            "searchWith": "Szukaj w {engine} lub wpisz adres", "tabs": "Karty", "done": "Gotowe", "closeAll": "Zamknij wszystkie",
            "bookmarks": "Zakładki", "history": "Historia", "settings": "Ustawienia", "menu": "Menu",
            "addBookmark": "Dodaj zakładkę", "removeBookmark": "Usuń zakładkę", "share": "Udostępnij",
            "searchEngine": "Wyszukiwarka", "blockTrackers": "Blokuj trackery i reklamy",
            "blockTrackersInfo": "Reklamy i trackery z {n} sieci są zatrzymywane, zanim się wczytają.",
            "gooseMode": "Tryb gęsi (Goose Web)", "language": "Język", "systemDefault": "Systemowy",
            "joinDiscord": "Dołącz do Discorda", "about": "O programie {name}", "version": "Wersja {v}",
            "aboutText": "Szybka, prywatna przeglądarka. Na iPhonie działa na silniku WebKit od Apple, jak każda przeglądarka na iOS.",
            "checkUpdates": "Sprawdź aktualizacje", "noBookmarks": "Brak zakładek. Stuknij ☆ w menu, aby zapisać stronę.",
            "noHistory": "Jeszcze nigdzie nie latałeś.", "clearHistory": "Wyczyść historię", "addShortcut": "Dodaj skrót",
            "name": "Nazwa", "webAddress": "Adres strony", "add": "Dodaj", "cancel": "Anuluj", "delete": "Usuń",
            "invalidAddress": "To nie wygląda na adres strony.",
            "greetMorning": "Dzień dobry", "greetAfternoon": "Dzień dobry", "greetEvening": "Dobry wieczór",
            "greetNight": "Nie śpisz? {birds} też nie", "pigeons": "Gołębie", "geese": "Gęsi", "honk": "Gę gę!",
            "today": "Dzisiaj", "earlier": "Wcześniej"
        ],
        "de": [
            "newTab": "Neuer Tab", "newTabButton": "Neuer Tab", "searchPlaceholder": "Suchen oder Adresse eingeben",
            "searchWith": "Mit {engine} suchen oder URL eingeben", "tabs": "Tabs", "done": "Fertig", "closeAll": "Alle schließen",
            "bookmarks": "Lesezeichen", "history": "Verlauf", "settings": "Einstellungen", "menu": "Menü",
            "addBookmark": "Lesezeichen hinzufügen", "removeBookmark": "Lesezeichen entfernen", "share": "Teilen",
            "searchEngine": "Suchmaschine", "blockTrackers": "Tracker & Werbung blockieren",
            "blockTrackersInfo": "Werbung und Tracker aus {n} Netzwerken werden gestoppt, bevor sie laden.",
            "gooseMode": "Gänsemodus (Goose Web)", "language": "Sprache", "systemDefault": "Systemsprache",
            "joinDiscord": "Tritt unserem Discord bei", "about": "Über {name}", "version": "Version {v}",
            "aboutText": "Ein schneller, privater Browser. Auf dem iPhone läuft er wie jeder iOS-Browser mit Apples WebKit.",
            "checkUpdates": "Nach Updates suchen", "noBookmarks": "Noch keine Lesezeichen. Tippe im Menü auf ☆, um eine Seite zu speichern.",
            "noHistory": "Noch nirgendwo hingeflogen.", "clearHistory": "Verlauf löschen", "addShortcut": "Verknüpfung hinzufügen",
            "name": "Name", "webAddress": "Webadresse", "add": "Hinzufügen", "cancel": "Abbrechen", "delete": "Löschen",
            "invalidAddress": "Das sieht nicht nach einer Webadresse aus.",
            "greetMorning": "Guten Morgen", "greetAfternoon": "Guten Tag", "greetEvening": "Guten Abend",
            "greetNight": "Noch wach? Die {birds} auch", "pigeons": "Tauben", "geese": "Gänse", "honk": "Honk!",
            "today": "Heute", "earlier": "Früher"
        ],
        "es": [
            "newTab": "Nueva pestaña", "newTabButton": "Nueva pestaña", "searchPlaceholder": "Busca o escribe una dirección",
            "searchWith": "Busca con {engine} o escribe una URL", "tabs": "Pestañas", "done": "Listo", "closeAll": "Cerrar todas",
            "bookmarks": "Marcadores", "history": "Historial", "settings": "Ajustes", "menu": "Menú",
            "addBookmark": "Añadir marcador", "removeBookmark": "Quitar marcador", "share": "Compartir",
            "searchEngine": "Buscador", "blockTrackers": "Bloquear rastreadores y anuncios",
            "blockTrackersInfo": "Los anuncios y rastreadores de {n} redes se detienen antes de cargarse.",
            "gooseMode": "Modo ganso (Goose Web)", "language": "Idioma", "systemDefault": "Idioma del sistema",
            "joinDiscord": "Únete a nuestro Discord", "about": "Acerca de {name}", "version": "Versión {v}",
            "aboutText": "Un navegador rápido y privado. En iPhone usa el motor WebKit de Apple, como todos los navegadores de iOS.",
            "checkUpdates": "Buscar actualizaciones", "noBookmarks": "Aún no hay marcadores. Toca ☆ en el menú para guardar una página.",
            "noHistory": "Aún no has volado a ningún sitio.", "clearHistory": "Borrar historial", "addShortcut": "Añadir acceso directo",
            "name": "Nombre", "webAddress": "Dirección web", "add": "Añadir", "cancel": "Cancelar", "delete": "Eliminar",
            "invalidAddress": "Eso no parece una dirección web.",
            "greetMorning": "Buenos días", "greetAfternoon": "Buenas tardes", "greetEvening": "Buenas noches",
            "greetNight": "¿Despierto aún? Las {birds} también", "pigeons": "palomas", "geese": "ocas", "honk": "¡Honk!",
            "today": "Hoy", "earlier": "Antes"
        ],
        "fr": [
            "newTab": "Nouvel onglet", "newTabButton": "Nouvel onglet", "searchPlaceholder": "Rechercher ou saisir une adresse",
            "searchWith": "Rechercher avec {engine} ou saisir une URL", "tabs": "Onglets", "done": "OK", "closeAll": "Tout fermer",
            "bookmarks": "Favoris", "history": "Historique", "settings": "Réglages", "menu": "Menu",
            "addBookmark": "Ajouter aux favoris", "removeBookmark": "Retirer des favoris", "share": "Partager",
            "searchEngine": "Moteur de recherche", "blockTrackers": "Bloquer traqueurs et pubs",
            "blockTrackersInfo": "Les pubs et traqueurs de {n} réseaux sont bloqués avant leur chargement.",
            "gooseMode": "Mode oie (Goose Web)", "language": "Langue", "systemDefault": "Langue du système",
            "joinDiscord": "Rejoignez notre Discord", "about": "À propos de {name}", "version": "Version {v}",
            "aboutText": "Un navigateur rapide et privé. Sur iPhone, il utilise le moteur WebKit d’Apple, comme tous les navigateurs iOS.",
            "checkUpdates": "Rechercher des mises à jour", "noBookmarks": "Aucun favori. Touchez ☆ dans le menu pour enregistrer une page.",
            "noHistory": "Vous n’avez encore volé nulle part.", "clearHistory": "Effacer l’historique", "addShortcut": "Ajouter un raccourci",
            "name": "Nom", "webAddress": "Adresse web", "add": "Ajouter", "cancel": "Annuler", "delete": "Supprimer",
            "invalidAddress": "Cela ne ressemble pas à une adresse web.",
            "greetMorning": "Bonjour", "greetAfternoon": "Bon après-midi", "greetEvening": "Bonsoir",
            "greetNight": "Encore debout ? Les {birds} aussi", "pigeons": "pigeons", "geese": "oies", "honk": "Honk !",
            "today": "Aujourd’hui", "earlier": "Plus tôt"
        ],
        "pt": [
            "newTab": "Nova guia", "newTabButton": "Nova guia", "searchPlaceholder": "Pesquise ou digite um endereço",
            "searchWith": "Pesquise com {engine} ou digite uma URL", "tabs": "Guias", "done": "OK", "closeAll": "Fechar todas",
            "bookmarks": "Favoritos", "history": "Histórico", "settings": "Ajustes", "menu": "Menu",
            "addBookmark": "Adicionar aos favoritos", "removeBookmark": "Remover favorito", "share": "Compartilhar",
            "searchEngine": "Mecanismo de pesquisa", "blockTrackers": "Bloquear rastreadores e anúncios",
            "blockTrackersInfo": "Anúncios e rastreadores de {n} redes são bloqueados antes de carregar.",
            "gooseMode": "Modo ganso (Goose Web)", "language": "Idioma", "systemDefault": "Idioma do sistema",
            "joinDiscord": "Entre no nosso Discord", "about": "Sobre o {name}", "version": "Versão {v}",
            "aboutText": "Um navegador rápido e privado. No iPhone ele usa o motor WebKit da Apple, como todo navegador iOS.",
            "checkUpdates": "Verificar atualizações", "noBookmarks": "Nenhum favorito ainda. Toque em ☆ no menu para salvar uma página.",
            "noHistory": "Você ainda não voou para lugar nenhum.", "clearHistory": "Limpar histórico", "addShortcut": "Adicionar atalho",
            "name": "Nome", "webAddress": "Endereço web", "add": "Adicionar", "cancel": "Cancelar", "delete": "Excluir",
            "invalidAddress": "Isso não parece um endereço web.",
            "greetMorning": "Bom dia", "greetAfternoon": "Boa tarde", "greetEvening": "Boa noite",
            "greetNight": "Acordado ainda? Os {birds} também", "pigeons": "pombos", "geese": "gansos", "honk": "Honk!",
            "today": "Hoje", "earlier": "Antes"
        ]
    ]
}
