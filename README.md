# LsJ⚔️VPN - Система интеграции

Полная система интеграции для автоматического подключения к VPN сервису LsJ⚔️VPN через приложение v2raytun.

## 📁 Структура проекта

```
LsJVPN-Integration/
├── index.html              # Основная страница с красивым интерфейсом
├── direct-link.html        # Страница для автоматического открытия приложения
├── qr-code.html           # Страница с QR-кодом для подключения
├── v2ray-config.json      # Конфигурационный файл для v2raytun
└── README.md              # Этот файл с инструкциями
```

## 🚀 Быстрый старт

### 1. Основная страница (index.html)
- **URL**: `https://ваш-домен.com/index.html`
- **Описание**: Красивый интерфейс с кнопкой подключения и информацией о сервисе
- **Функции**: 
  - Автоматическое открытие v2raytun
  - Копирование конфигурации в буфер обмена
  - Ссылка на Telegram бот

### 2. Прямая ссылка (direct-link.html)
- **URL**: `https://ваш-домен.com/direct-link.html`
- **Описание**: Автоматическое открытие приложения при загрузке страницы
- **Функции**:
  - Множественные попытки открытия приложения
  - Fallback ссылка если приложение не найдено
  - Специальная оптимизация для iOS

### 3. QR-код (qr-code.html)
- **URL**: `https://ваш-домен.com/qr-code.html`
- **Описание**: QR-код для сканирования камерой телефона
- **Функции**:
  - Генерация QR-кода с конфигурацией
  - Кнопка для ручного подключения
  - Инструкции для пользователей

## 🔧 Конфигурация сервера

### Текущие настройки:
- **IP**: 80.74.25.92
- **Порт**: 443
- **Протокол**: VLESS
- **UUID**: 29cc9902-2a2c-4831-abf3-6471325bf352
- **Сетевой протокол**: gRPC
- **Service Name**: google-gpc-service
- **TLS**: Reality
- **SNI**: www.booking.com
- **Fingerprint**: Chrome

## 📱 Поддерживаемые приложения

### iOS:
- **v2raytun** (рекомендуется)
- **Shadowrocket**
- **Quantumult X**

### Android:
- **v2rayNG**
- **Clash for Android**
- **SagerNet**

## 🌐 Развертывание

### Вариант 1: Статический хостинг
1. Загрузите все файлы на любой статический хостинг (GitHub Pages, Netlify, Vercel)
2. Настройте домен
3. Готово!

### Вариант 2: VPS/Сервер
1. Установите веб-сервер (nginx, Apache)
2. Скопируйте файлы в директорию сайта
3. Настройте SSL сертификат
4. Готово!

### Вариант 3: GitHub Pages (бесплатно)
1. Создайте репозиторий на GitHub
2. Загрузите файлы
3. Включите GitHub Pages в настройках репозитория
4. Получите URL вида: `https://username.github.io/repository-name`

## 🔗 Генерация ссылок

### Автоматическое подключение:
```
https://ваш-домен.com/direct-link.html
```

### С QR-кодом:
```
https://ваш-домен.com/qr-code.html
```

### Основная страница:
```
https://ваш-домен.com/index.html
```

### С автоподключением:
```
https://ваш-домен.com/index.html?auto=true
```

## 📊 Аналитика и мониторинг

Для отслеживания использования можно добавить:

### Google Analytics:
```html
<!-- Добавьте в <head> каждой страницы -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Простая статистика:
```javascript
// Добавьте в функцию connectVPN()
fetch('https://ваш-api.com/analytics', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        action: 'vpn_connect',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    })
});
```

## 🎨 Кастомизация

### Изменение цветов:
Отредактируйте CSS переменные в файлах:
```css
:root {
    --primary-color: #f39c12;
    --secondary-color: #2c3e50;
    --success-color: #28a745;
    --telegram-color: #0088cc;
}
```

### Изменение логотипа:
Замените эмодзи ⚔️ на вашу иконку или изображение:
```html
<div class="logo">
    <img src="path/to/your/logo.png" alt="LsJ⚔️VPN">
</div>
```

### Добавление новых серверов:
Отредактируйте объект `vpnConfig` в JavaScript:
```javascript
const vpnConfig = {
    // Ваши новые настройки
};
```

## 🔒 Безопасность

### Рекомендации:
1. Используйте HTTPS для всех страниц
2. Настройте CSP (Content Security Policy)
3. Регулярно обновляйте UUID сервера
4. Мониторьте логи подключений

### CSP заголовок:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';
```

## 📞 Поддержка

- **Telegram бот**: @L_S_J_PREMIUM1_bot
- **Описание**: Comrades | Free

## 🚀 Обновления

### Версия 1.0
- ✅ Основная функциональность
- ✅ Автоматическое открытие приложения
- ✅ QR-код для подключения
- ✅ Красивый адаптивный интерфейс
- ✅ Поддержка iOS и Android

### Планы на будущее:
- [ ] Множественные серверы
- [ ] Система подписок
- [ ] Аналитика подключений
- [ ] Многоязычная поддержка
- [ ] PWA (Progressive Web App)

---

**Создано для LsJ⚔️VPN** ⚔️
