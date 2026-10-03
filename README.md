# FitAdmin SaaS — Sistema de Gestión Integral para Gimnasios 🏋️‍♂️

FitAdmin SaaS es una aplicación web moderna, responsiva y en tiempo real diseñada para la administración integral de gimnasios, clubes de fitness y centros deportivos.

Construida con **TypeScript**, **Tailwind CSS v4**, **Vite** y **Firebase Firestore / Auth**.

---

## 🚀 Despliegue en Netlify y GitHub

Esta aplicación está completamente preparada para funcionar y desplegarse en **GitHub Pages** y **Netlify** de forma directa.

### 🌐 Opción 1: Despliegue en Netlify

El repositorio ya incluye los archivos de configuración oficiales:
- `netlify.toml`: Configuración de compilación (`npm run build`), directorio de publicación (`dist`) y reglas de enrutamiento SPA (`/* -> /index.html 200`).
- `public/_redirects`: Regla fallback para garantizar que las rutas y recargas funcionen sin error 404.

#### Pasos para Netlify:
1. Conecta tu repositorio de GitHub a tu cuenta en [Netlify](https://www.netlify.com/).
2. En la configuración de compilación, Netlify detectará automáticamente:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
3. *(Opcional)* En la sección **Site Configuration > Environment Variables**, puedes agregar tu `GEMINI_API_KEY` para habilitar el asistente de IA FitBot.
4. Haz clic en **Deploy Site**. ¡Tu aplicación estará en línea en segundos!

---

### 🐙 Opción 2: Despliegue en GitHub Pages

El repositorio incluye el flujo de trabajo de GitHub Actions en `.github/workflows/deploy.yml`:
1. Sube tu proyecto a un repositorio de GitHub (`main`).
2. Ve a la pestaña **Settings > Pages** de tu repositorio en GitHub.
3. En **Source**, selecciona **GitHub Actions**.
4. Cada vez que hagas un `git push` a la rama `main`, GitHub compilará y publicará automáticamente tu aplicación en GitHub Pages.

---

## 💻 Desarrollo Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/fitadmin-saas.git
cd fitadmin-saas
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 4. Compilar para producción
```bash
npm run build
```
Los archivos estáticos optimizados se generarán en la carpeta `dist/`.

---

## ✨ Características Principales

1. **Gestión de Socios y Membresías:**
   - Monitoreo en tiempo real de socios activos, por vencer y vencidos.
   - Búsqueda instantánea y filtros dinámicos por estado y plan.
   - Notificaciones y alertas de renovación preventiva.

2. **Catálogo de Planes con Eliminación Permanente:**
   - Edición y creación de planes con cuotas fijadas por el administrador en pesos.
   - Eliminación garantizada: cuando se elimina un plan del catálogo, se borra de la base de datos y se registra para que no vuelva a regenerarse jamás.

3. **Campana de Notificaciones en Tiempo Real:**
   - Contador de alertas pendientes con badge visual.
   - Pestañas de filtrado entre "Todas" y "No leídas".
   - Botón "Marcar todas como leídas" y botones individuales por alerta.
   - Navegación directa al hacer clic en una notificación hacia el socio, cobro o ingreso correspondiente.
   - Opción para limpiar el historial de notificaciones leídas.

4. **Finanzas y Movimientos de Caja:**
   - Registro de ingresos y gastos operativos con balance neto en vivo.
   - Borrado instantáneo (en 0 ms) de movimientos con opción interactiva de deshacer.

5. **Control de Asistencia en Portería:**
   - Registro rápido de ingresos al gimnasio por socio y actividad.
   - Verificación del estado de cuota al momento del check-in.

6. **FitBot AI & Exportación Ejecutiva:**
   - Asistente de consultas impulsado por Google Gemini.
   - Generación y descarga de informes ejecutivos mensuales en PDF listos para imprimir o compartir.
