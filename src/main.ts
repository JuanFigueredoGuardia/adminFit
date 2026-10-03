/**
 * ==============================================================================
 * FitAdmin SaaS - Panel de Administración para Gimnasios
 * Arquitectura: Mobile-First, Tailwind CSS, TypeScript y Firebase Firestore
 * ==============================================================================
 * 
 * Este módulo contiene:
 * 1. Inicialización y sincronización en tiempo real con Firebase Firestore (onSnapshot)
 * 2. Gestión de Planes de Membresía y Cuotas personalizadas fijadas por el Administrador
 * 3. Operaciones CRUD en vivo para la colección 'socios' (Nombre, Plan, Cuota, Fechas, Estado)
 * 4. Controladores de interfaz responsiva (Sidebar Móvil, Tabla Desktop vs Tarjetas Móviles)
 * 5. Gestión Financiera en tiempo real y exportación de reportes ejecutivos en PDF
 */

import { generateMonthlyPDFReport } from './services/pdfReportService';
import {
  db,
  auth,
  Plan,
  Socio,
  EstadoSocio,
  Transaction,
  Attendance,
  TipoTransaccion,
  DEFAULT_PLANS,
  DEFAULT_SOCIOS,
  DEFAULT_TRANSACTIONS,
  DEFAULT_ATTENDANCES,
  formatPesos,
  subscribeToPlans,
  subscribeToSocios,
  subscribeToTransactions,
  subscribeToAttendances,
  addPlanToFirestore,
  updatePlanInFirestore,
  deletePlanFromFirestore,
  addSocioToFirestore,
  updateSocioInFirestore,
  deleteSocioFromFirestore,
  addTransactionToFirestore,
  updateTransactionInFirestore,
  deleteTransactionFromFirestore,
  addAttendanceToFirestore,
  updateAttendanceInFirestore,
  deleteAttendanceFromFirestore,
  onFirebaseConnectionChange,
  signInWithGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  signOutFirebase,
  subscribeToAuth,
  getCurrentUser
} from './services/firebase';
import { collection, addDoc } from 'firebase/firestore';

// Re-exportar tipos para compatibilidad con servicios como pdfReportService
export type { Plan, Socio, EstadoSocio, Transaction, Attendance, TipoTransaccion };

// Declaración para Lucide Icons disponible globalmente desde el script de CDN
declare global {
  interface Window {
    lucide?: {
      createIcons: () => void;
    };
  }
}

/* ==============================================================================
 * ESTADO GLOBAL EN MEMORIA (Sincronizado reactivamente con Firestore)
 * ============================================================================== */
let sociosState: Socio[] = [];
let plansCatalog: Plan[] = [];
let currentFilter: 'all' | EstadoSocio = 'all';
let currentSearchQuery = '';
let isFirebaseConnected = false;

// Estado de Finanzas & Transacciones
let transactionsState: Transaction[] = [];
let currentTxFilter: 'all' | 'ingreso' | 'gasto' = 'all';
let currentTxSearchQuery = '';

// Estado de Control de Asistencias & Check-ins
let attendancesState: Attendance[] = [];
let currentAttFilter: 'today' | 'all' = 'today';
let currentAttSearchQuery = '';

/* ==============================================================================
 * SELECTORES DEL DOM
 * ============================================================================== */

// Sidebar & Navegación
const sidebar = document.getElementById('main-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const btnFloatingMenu = document.getElementById('btn-floating-menu');
const navBtnAnalytics = document.getElementById('nav-btn-analytics');
const navBtnAttendance = document.getElementById('nav-btn-attendance');

// Contenedores de Socios
const tableBody = document.getElementById('socios-table-body');
const cardsContainer = document.getElementById('socios-cards-container');
const tableEmptyState = document.getElementById('table-empty-state');
const cardsEmptyState = document.getElementById('cards-empty-state');

// Búsqueda y Filtros de Socios
const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
const statusFilterButtons = document.querySelectorAll<HTMLButtonElement>('.filter-btn');
const metricInteractiveCards = document.querySelectorAll<HTMLElement>('.metric-interactive-card');
const filterActiveIndicator = document.getElementById('filter-active-indicator');
const filterActiveName = document.getElementById('filter-active-name');
const btnClearFilter = document.getElementById('btn-clear-filter');

// Métricas y KPIs de Socios
const metricActiveCount = document.getElementById('metric-active-count');
const metricExpiringCount = document.getElementById('metric-expiring-count');
const metricIncomeAmount = document.getElementById('metric-income-amount');
const badgeTotalSocios = document.getElementById('badge-total-socios');

const filterCountAll = document.getElementById('filter-count-all');
const filterCountActivo = document.getElementById('filter-count-activo');
const filterCountPorVencer = document.getElementById('filter-count-por-vencer');
const filterCountVencido = document.getElementById('filter-count-vencido');

// Modal Socio
const modalSocio = document.getElementById('modal-socio');
const formSocio = document.getElementById('form-socio') as HTMLFormElement | null;
const modalSocioTitle = document.getElementById('modal-socio-title');
const btnCloseSocioModal = document.getElementById('btn-close-socio-modal');
const btnCancelSocio = document.getElementById('btn-cancel-socio');
const btnOpenNewSocioModal = document.getElementById('btn-open-new-socio-modal');
const btnHeaderNewSocio = document.getElementById('btn-header-new-socio');

// Modal Interactivo de Confirmación para Eliminar
const modalConfirmDelete = document.getElementById('modal-confirm-delete');
const confirmDeleteTitle = document.getElementById('confirm-delete-title');
const confirmDeleteItemTag = document.getElementById('confirm-delete-item-tag');
const confirmDeleteItemName = document.getElementById('confirm-delete-item-name');
const confirmDeleteItemDesc = document.getElementById('confirm-delete-item-desc');
const confirmDeleteWarning = document.getElementById('confirm-delete-warning');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDeleteAction = document.getElementById('btn-confirm-delete-action') as HTMLButtonElement | null;
const btnConfirmDeleteText = document.getElementById('btn-confirm-delete-text');

// Modal Catálogo de Planes
const modalPlans = document.getElementById('modal-plans');
const btnSidebarPlans = document.getElementById('btn-sidebar-plans');
const btnBannerPlans = document.getElementById('btn-banner-plans');
const btnOpenPlansCatalog = document.getElementById('btn-open-plans-catalog');
const navBtnPlans = document.getElementById('nav-btn-plans');
const btnClosePlansModal = document.getElementById('btn-close-plans-modal');
const btnDonePlansModal = document.getElementById('btn-done-plans-modal');
const formNewPlan = document.getElementById('form-new-plan') as HTMLFormElement | null;
const inputEditPlanId = document.getElementById('input-edit-plan-id') as HTMLInputElement | null;
const formPlanTitle = document.getElementById('form-plan-title');
const btnCancelEditPlan = document.getElementById('btn-cancel-edit-plan');
const inputNewPlanName = document.getElementById('input-new-plan-name') as HTMLInputElement | null;
const inputNewPlanPrice = document.getElementById('input-new-plan-price') as HTMLInputElement | null;
const btnSubmitPlanText = document.getElementById('btn-submit-plan-text');
const plansListContainer = document.getElementById('plans-list-container');
const datalistPlanes = document.getElementById('planes-sugeridos');
const quickPlansContainer = document.getElementById('quick-plans-container');

// Botón de Reporte PDF
const btnDownloadPdfReport = document.getElementById('btn-download-pdf-report');

// Selectores de Finanzas
const searchTransactionsInput = document.getElementById('search-transactions-input') as HTMLInputElement | null;
const txFilterButtons = document.querySelectorAll<HTMLButtonElement>('.tx-filter-btn');
const txCountAll = document.getElementById('tx-count-all');
const txCountIngresos = document.getElementById('tx-count-ingresos');
const txCountGastos = document.getElementById('tx-count-gastos');
const transactionsTableBody = document.getElementById('transactions-table-body');
const transactionsEmptyState = document.getElementById('transactions-empty-state');
const transactionsCardsContainer = document.getElementById('transactions-cards-container');
const btnOpenNewTransactionModal = document.getElementById('btn-open-new-transaction-modal');
const modalTransaction = document.getElementById('modal-transaction');
const btnCloseTransactionModal = document.getElementById('btn-close-transaction-modal');
const btnCancelTransaction = document.getElementById('btn-cancel-transaction');
const formTransaction = document.getElementById('form-transaction') as HTMLFormElement | null;
const modalTransactionTitle = document.getElementById('modal-transaction-title');
const txSociosDatalist = document.getElementById('tx-socios-list');
const btnDeleteModalTransaction = document.getElementById('btn-delete-modal-transaction') as HTMLButtonElement | null;

// Métricas de Finanzas
const badgeTotalTransactions = document.getElementById('badge-total-transactions');
const finanzasTotalIngresos = document.getElementById('finanzas-total-ingresos');
const finanzasTotalGastos = document.getElementById('finanzas-total-gastos');
const finanzasBalanceNeto = document.getElementById('finanzas-balance-neto');
const finanzasBalanceBadge = document.getElementById('finanzas-balance-badge');

// Selectores de Control de Asistencia
const searchAttendanceInput = document.getElementById('search-attendance-input') as HTMLInputElement | null;
const btnAttendanceFilterToday = document.getElementById('btn-attendance-filter-today') as HTMLButtonElement | null;
const btnAttendanceFilterAll = document.getElementById('btn-attendance-filter-all') as HTMLButtonElement | null;
const attendancesTableBody = document.getElementById('attendances-table-body');
const attendancesEmptyState = document.getElementById('attendances-empty-state');
const attendancesCardsContainer = document.getElementById('attendances-cards-container');
const btnOpenNewAttendanceModal = document.getElementById('btn-open-new-attendance-modal');
const modalAttendance = document.getElementById('modal-attendance');
const btnCloseAttendanceModal = document.getElementById('btn-close-attendance-modal');
const btnCancelAttendance = document.getElementById('btn-cancel-attendance');
const formAttendance = document.getElementById('form-attendance') as HTMLFormElement | null;
const modalAttendanceTitle = document.getElementById('modal-attendance-title');
const attSociosDatalist = document.getElementById('att-socios-list');
const attSocioNombreInput = document.getElementById('att-socio-nombre') as HTMLInputElement | null;
const attPreviewPlan = document.getElementById('att-preview-plan');
const attPreviewBadge = document.getElementById('att-preview-badge');

// Métricas de Asistencia
const badgeTotalAttendances = document.getElementById('badge-total-attendances');
const attendanceTodayCount = document.getElementById('attendance-today-count');
const attendanceTotalCount = document.getElementById('attendance-total-count');
const attendanceTopActivity = document.getElementById('attendance-top-activity');

// Selectores de Autenticación del Administrador (Firebase Auth)
const modalAuth = document.getElementById('modal-auth');
const modalAuthTitle = document.getElementById('modal-auth-title');
const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
const btnGoogleLogin = document.getElementById('btn-google-login');
const tabBtnLogin = document.getElementById('tab-btn-login');
const tabBtnRegister = document.getElementById('tab-btn-register');
const tabBtnReset = document.getElementById('tab-btn-reset');
const formAuthLogin = document.getElementById('form-auth-login') as HTMLFormElement | null;
const formAuthRegister = document.getElementById('form-auth-register') as HTMLFormElement | null;
const formAuthReset = document.getElementById('form-auth-reset') as HTMLFormElement | null;
const btnGotoResetLink = document.getElementById('btn-goto-reset-link');
const btnGotoRegisterLink = document.getElementById('btn-goto-register-link');
const btnGotoLoginLink = document.getElementById('btn-goto-login-link');
const btnResetBackLink = document.getElementById('btn-reset-back-link');
const headerAuthContainer = document.getElementById('header-auth-container');
const btnHeaderLogin = document.getElementById('btn-header-login');
const btnSidebarAuth = document.getElementById('btn-sidebar-auth');
const sidebarAdminName = document.getElementById('sidebar-admin-name');
const sidebarAdminEmail = document.getElementById('sidebar-admin-email');
const sidebarAdminAvatar = document.getElementById('sidebar-admin-avatar');
const sidebarAdminStatusDot = document.getElementById('sidebar-admin-status-dot');

// Selectores de FitBot AI (Gemini Chatbot)
const modalGeminiChat = document.getElementById('modal-gemini-chat');
const btnCloseChatModal = document.getElementById('btn-close-chat-modal');
const btnHeaderAi = document.getElementById('btn-header-ai');
const btnSidebarAi = document.getElementById('btn-sidebar-ai');
const btnFloatingAi = document.getElementById('btn-floating-ai');
const btnClearChat = document.getElementById('btn-clear-chat');
const btnModelLite = document.getElementById('btn-model-lite');
const btnModelFlash = document.getElementById('btn-model-flash');
const formGeminiChat = document.getElementById('form-gemini-chat') as HTMLFormElement | null;
const inputChatMessage = document.getElementById('input-chat-message') as HTMLInputElement | null;
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatTypingIndicator = document.getElementById('chat-typing-indicator');

// Selectores de Notificaciones (Campanita & Panel)
const btnNotifications = document.getElementById('btn-notifications');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationsBadge = document.getElementById('notifications-badge');
const notificationsUnreadPill = document.getElementById('notifications-unread-pill');
const notificationsList = document.getElementById('notifications-list');
const btnMarkAllRead = document.getElementById('btn-mark-all-read');
const btnCloseNotifications = document.getElementById('btn-close-notifications');
const notifFilterAll = document.getElementById('notif-filter-all');
const notifFilterUnread = document.getElementById('notif-filter-unread');
const notifCountAll = document.getElementById('notif-count-all');
const notifCountUnread = document.getElementById('notif-count-unread');
const btnClearReadNotifications = document.getElementById('btn-clear-read-notifications');

/* ==============================================================================
 * SISTEMA DE NOTIFICACIONES TOAST FLOTANTES
 * ============================================================================== */

function showToast(title: string, message: string, type: 'success' | 'error' | 'info' = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const borderCol = type === 'success' ? 'border-emerald-500/50 text-emerald-400' :
                    type === 'error' ? 'border-rose-500/50 text-rose-400' :
                    'border-teal-500/50 text-teal-400';
  const icon = type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-circle' : 'info';

  toast.className = `p-3 rounded-xl bg-slate-900 border ${borderCol} shadow-2xl flex items-start gap-2.5 text-xs transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto backdrop-blur-md`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 shrink-0 mt-0.5"></i>
    <div class="flex-1 min-w-0">
      <p class="font-bold text-white text-xs">${escapeHtml(title)}</p>
      <p class="text-slate-300 mt-0.5 text-[11px] leading-tight">${escapeHtml(message)}</p>
    </div>
  `;
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showToastWithAction(
  title: string,
  message: string,
  actionText: string,
  onAction: () => Promise<void> | void,
  type: 'success' | 'error' | 'info' = 'success'
) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const borderCol = type === 'success' ? 'border-emerald-500/50 text-emerald-400' :
                    type === 'error' ? 'border-rose-500/50 text-rose-400' :
                    'border-teal-500/50 text-teal-400';
  const icon = type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-circle' : 'info';

  toast.className = `p-3.5 rounded-xl bg-slate-900 border ${borderCol} shadow-2xl flex items-center justify-between gap-3 text-xs transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto backdrop-blur-md`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'flex items-start gap-2.5 flex-1 min-w-0';
  contentDiv.innerHTML = `
    <i data-lucide="${icon}" class="w-4 h-4 shrink-0 mt-0.5"></i>
    <div class="flex-1 min-w-0">
      <p class="font-bold text-white text-xs">${escapeHtml(title)}</p>
      <p class="text-slate-300 mt-0.5 text-[11px] leading-tight">${escapeHtml(message)}</p>
    </div>
  `;

  const actionBtn = document.createElement('button');
  actionBtn.className = 'px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 hover:text-white border border-teal-500/40 font-bold text-xs shrink-0 transition-colors active:scale-95 flex items-center gap-1 shadow-sm';
  actionBtn.innerHTML = `<i data-lucide="rotate-ccw" class="w-3 h-3"></i> ${escapeHtml(actionText)}`;

  toast.appendChild(contentDiv);
  toast.appendChild(actionBtn);
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  let actionTriggered = false;
  actionBtn.addEventListener('click', async () => {
    if (actionTriggered) return;
    actionTriggered = true;
    actionBtn.disabled = true;
    actionBtn.innerHTML = '<span class="w-3 h-3 border border-teal-300 border-t-transparent rounded-full animate-spin"></span>';
    try {
      await onAction();
    } finally {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    }
  });

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    if (!actionTriggered) {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

/* ==============================================================================
 * CONTROLADORES DE MODALES Y NAVEGACIÓN MOBILE-FIRST
 * ============================================================================== */

function openSidebar() {
  sidebar?.classList.remove('-translate-x-full');
  sidebarBackdrop?.classList.remove('hidden');
  document.body.classList.add('overflow-hidden', 'lg:overflow-auto');
}

function closeSidebar() {
  sidebar?.classList.add('-translate-x-full');
  sidebarBackdrop?.classList.add('hidden');
  document.body.classList.remove('overflow-hidden', 'lg:overflow-auto');
}

btnToggleSidebar?.addEventListener('click', openSidebar);
btnFloatingMenu?.addEventListener('click', openSidebar);
btnCloseSidebar?.addEventListener('click', closeSidebar);
sidebarBackdrop?.addEventListener('click', closeSidebar);

function openModal(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeModal(el: HTMLElement | null) {
  if (!el) return;
  el.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidebar();
    closeModal(modalSocio);
    closeModal(modalPlans);
    closeModal(modalTransaction);
    closeModal(modalAttendance);
    closeModal(modalAuth);
    closeModal(modalGeminiChat);
    notificationsDropdown?.classList.add('hidden');
    cancelConfirmation();
  }
});

/* ==============================================================================
 * MODAL INTERACTIVO DE CONFIRMACIÓN PARA ELIMINAR (SOCIOS, PLANES, FINANZAS, ASISTENCIAS)
 * ============================================================================== */

interface ConfirmDeleteOptions {
  title?: string;
  itemType: string;
  itemName: string;
  itemDesc?: string;
  warning?: string;
  confirmBtnText?: string;
  onConfirm: () => Promise<void> | void;
}

let pendingDeleteAction: (() => Promise<void> | void) | null = null;

function requestConfirmation(options: ConfirmDeleteOptions) {
  if (confirmDeleteTitle) {
    confirmDeleteTitle.textContent = options.title || '¿Estás seguro de eliminar este registro?';
  }
  if (confirmDeleteItemTag) {
    confirmDeleteItemTag.textContent = options.itemType;
  }
  if (confirmDeleteItemName) {
    confirmDeleteItemName.textContent = options.itemName;
  }
  if (confirmDeleteItemDesc) {
    confirmDeleteItemDesc.textContent = options.itemDesc || '';
    (confirmDeleteItemDesc as HTMLElement).style.display = options.itemDesc ? 'block' : 'none';
  }
  if (confirmDeleteWarning) {
    confirmDeleteWarning.textContent = options.warning || 'Esta acción no se puede deshacer. Los datos serán removidos permanentemente del sistema.';
  }

  if (btnConfirmDeleteAction) {
    btnConfirmDeleteAction.disabled = false;
  }
  if (btnConfirmDeleteText) {
    btnConfirmDeleteText.textContent = options.confirmBtnText || 'Sí, Eliminar';
  }

  pendingDeleteAction = options.onConfirm;
  openModal(modalConfirmDelete);
}

function cancelConfirmation() {
  pendingDeleteAction = null;
  closeModal(modalConfirmDelete);
}

btnCancelDelete?.addEventListener('click', cancelConfirmation);

btnConfirmDeleteAction?.addEventListener('click', async () => {
  if (!pendingDeleteAction) {
    closeModal(modalConfirmDelete);
    return;
  }

  const originalText = btnConfirmDeleteText?.textContent || 'Sí, Eliminar';
  if (btnConfirmDeleteAction) {
    btnConfirmDeleteAction.disabled = true;
  }
  if (btnConfirmDeleteText) {
    btnConfirmDeleteText.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></span> Eliminando...';
  }

  try {
    await pendingDeleteAction();
    closeModal(modalConfirmDelete);
  } catch (err) {
    console.error('Error al ejecutar la eliminación:', err);
    showToast('Error', 'No se pudo eliminar el registro. Intenta nuevamente.', 'error');
  } finally {
    if (btnConfirmDeleteAction) {
      btnConfirmDeleteAction.disabled = false;
    }
    if (btnConfirmDeleteText) {
      btnConfirmDeleteText.textContent = originalText;
    }
    pendingDeleteAction = null;
  }
});

modalConfirmDelete?.addEventListener('click', (e) => {
  if (e.target === modalConfirmDelete) {
    cancelConfirmation();
  }
});

// Eventos de Apertura y Cierre de Modales
btnOpenNewSocioModal?.addEventListener('click', () => {
  prepareSocioModalForCreate();
  openModal(modalSocio);
});

btnHeaderNewSocio?.addEventListener('click', () => {
  prepareSocioModalForCreate();
  openModal(modalSocio);
});

btnCloseSocioModal?.addEventListener('click', () => closeModal(modalSocio));
btnCancelSocio?.addEventListener('click', () => closeModal(modalSocio));

btnSidebarPlans?.addEventListener('click', () => openModal(modalPlans));
btnBannerPlans?.addEventListener('click', () => openModal(modalPlans));
btnOpenPlansCatalog?.addEventListener('click', () => openModal(modalPlans));
navBtnPlans?.addEventListener('click', (e) => {
  e.preventDefault();
  closeSidebar();
  openModal(modalPlans);
});
btnClosePlansModal?.addEventListener('click', () => closeModal(modalPlans));
btnDonePlansModal?.addEventListener('click', () => closeModal(modalPlans));

// Modal de Autenticación de Administrador
btnHeaderLogin?.addEventListener('click', () => {
  switchAuthTab('login');
  openModal(modalAuth);
});
btnSidebarAuth?.addEventListener('click', () => {
  if (currentAdminUser) {
    handleAdminSignOut();
  } else {
    switchAuthTab('login');
    openModal(modalAuth);
  }
});
btnCloseAuthModal?.addEventListener('click', () => closeModal(modalAuth));

// Modal de FitBot AI (Gemini Chatbot)
function openFitBotChat() {
  openModal(modalGeminiChat);
  setTimeout(() => inputChatMessage?.focus(), 150);
}

btnHeaderAi?.addEventListener('click', openFitBotChat);
btnSidebarAi?.addEventListener('click', () => {
  closeSidebar();
  openFitBotChat();
});
btnFloatingAi?.addEventListener('click', openFitBotChat);
btnCloseChatModal?.addEventListener('click', () => closeModal(modalGeminiChat));

/* ==============================================================================
 * GESTIÓN DE PLANES DE MEMBRESÍA Y TARIFAS (DEFINIDO POR EL ADMIN EN FIREBASE)
 * ============================================================================== */

/**
 * Renderiza los planes en:
 * 1. Datalist para autocompletar en el formulario de socio
 * 2. Chips rápidos con precio debajo del input
 * 3. Lista con botón de eliminar en el modal de gestión de planes
 */
function renderPlansUI() {
  // 1. Datalist para el input de texto en el formulario de socio
  if (datalistPlanes) {
    datalistPlanes.innerHTML = plansCatalog.map(p => `
      <option value="${escapeHtml(p.name)}">${formatPesos(p.price)} / período</option>
    `).join('');
  }

  // 2. Chips de selección rápida de plan en el formulario de socio
  if (quickPlansContainer) {
    quickPlansContainer.innerHTML = plansCatalog.slice(0, 6).map(p => `
      <button 
        type="button" 
        class="plan-quick-chip px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 hover:text-emerald-400 border border-slate-800 transition-colors flex items-center gap-1 active:scale-95"
        data-name="${escapeHtml(p.name)}"
        data-price="${p.price}"
        data-duration="${p.durationDays || 30}"
      >
        <span>${escapeHtml(p.name)}</span>
        <span class="font-mono text-emerald-400 font-bold">(${formatPesos(p.price)})</span>
      </button>
    `).join('');
  }

  // 3. Lista completa en el modal de gestión de planes
  if (plansListContainer) {
    if (plansCatalog.length === 0) {
      plansListContainer.innerHTML = `
        <div class="text-center py-6 text-slate-500 text-xs">
          <i data-lucide="tag" class="w-8 h-8 mx-auto mb-2 opacity-30"></i>
          <p>No hay planes en el catálogo actualmente.</p>
          <p class="text-[11px] mt-1 text-slate-400">Ingresa el nombre y la cuota arriba para agregar un nuevo plan.</p>
        </div>
      `;
    } else {
      plansListContainer.innerHTML = plansCatalog.map(p => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all text-xs group">
          <div class="min-w-0 pr-2">
            <div class="flex items-center gap-2">
              <p class="font-bold text-white text-xs truncate">${escapeHtml(p.name)}</p>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                ${p.durationDays || 30} días
              </span>
            </div>
            <p class="text-emerald-400 font-mono font-bold text-xs mt-0.5">${formatPesos(p.price)} <span class="text-slate-500 font-normal text-[11px]">/ cuota fijada por admin</span></p>
            ${p.description ? `<p class="text-slate-400 text-[11px] mt-1 truncate">${escapeHtml(p.description)}</p>` : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button 
              type="button" 
              data-use-plan="${escapeHtml(p.name)}"
              data-use-price="${p.price}"
              class="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition-colors"
              title="Asignar este plan"
            >
              Usar
            </button>
            <button 
              type="button" 
              data-edit-plan-id="${p.id}"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Editar este plan"
            >
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              type="button" 
              data-delete-plan-id="${p.id}"
              class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Eliminar este plan de Firestore"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function resetPlanForm() {
  if (inputEditPlanId) inputEditPlanId.value = '';
  if (inputNewPlanName) inputNewPlanName.value = '';
  if (inputNewPlanPrice) inputNewPlanPrice.value = '';
  if (formPlanTitle) formPlanTitle.textContent = 'Crear Nuevo Plan de Membresía';
  if (btnCancelEditPlan) btnCancelEditPlan.classList.add('hidden');
  if (btnSubmitPlanText) btnSubmitPlanText.textContent = 'Añadir';
}

btnCancelEditPlan?.addEventListener('click', resetPlanForm);

// Agregar o Editar plan desde el formulario del modal a Firebase Firestore
formNewPlan?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = inputEditPlanId?.value;
  const name = inputNewPlanName?.value.trim();
  const price = Number(inputNewPlanPrice?.value) || 0;
  if (!name) return;

  const submitBtn = formNewPlan.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  const originalText = submitBtn?.innerHTML || 'Añadir';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>';
  }

  try {
    if (editId) {
      await updatePlanInFirestore(editId, {
        name,
        price,
        description: `Plan de membresía ${name} con cuota mensual de ${formatPesos(price)} fijada por el administrador.`
      });
      showToast('Plan modificado', `Se actualizaron los datos del plan ${name}.`);
    } else {
      await addPlanToFirestore({
        name,
        price,
        durationDays: 30,
        description: `Plan de membresía ${name} con cuota mensual de ${formatPesos(price)} fijada por el administrador.`
      });
      showToast('Plan creado', `Se agregó el plan ${name} exitosamente.`);
    }
    resetPlanForm();
  } catch (err) {
    console.error('Error al guardar plan en Firestore:', err);
    showToast('Error', 'No se pudo guardar el plan.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
});

// Event Delegation para eliminar plan, editar plan o seleccionarlo desde el modal de planes
plansListContainer?.addEventListener('click', async (e) => {
  // 1. Eliminar plan
  const target = (e.target as HTMLElement).closest('button[data-delete-plan-id]') as HTMLButtonElement | null;
  if (target) {
    const id = target.getAttribute('data-delete-plan-id');
    if (!id) return;
    const plan = plansCatalog.find(p => p.id === id);
    requestConfirmation({
      title: '¿Eliminar este plan de membresía?',
      itemType: 'Plan de Membresía',
      itemName: plan?.name || 'Plan',
      itemDesc: `Cuota establecida: ${formatPesos(plan?.price || 0)}/mes`,
      warning: 'Los socios activos que ya tienen asignado este plan mantendrán su cuota hasta que decidas modificarla.',
      confirmBtnText: 'Sí, Eliminar Plan',
      onConfirm: async () => {
        const planName = plan?.name;
        // 1. Eliminación optimista inmediata del catálogo local
        plansCatalog = plansCatalog.filter(p => p.id !== id && (planName ? p.name.toLowerCase() !== planName.toLowerCase() : true));
        renderPlansUI();

        // 2. Eliminación permanente en Firestore (por ID y por nombre)
        await deletePlanFromFirestore(id, planName);
        showToast('Plan eliminado', `El plan "${planName || ''}" ha sido eliminado y no volverá a aparecer.`);
        if (inputEditPlanId?.value === id) {
          resetPlanForm();
        }
      }
    });
    return;
  }

  // 2. Editar plan
  const editBtn = (e.target as HTMLElement).closest('button[data-edit-plan-id]') as HTMLButtonElement | null;
  if (editBtn) {
    const id = editBtn.getAttribute('data-edit-plan-id');
    const plan = plansCatalog.find(p => p.id === id);
    if (plan) {
      if (inputEditPlanId) inputEditPlanId.value = plan.id;
      if (inputNewPlanName) inputNewPlanName.value = plan.name;
      if (inputNewPlanPrice) inputNewPlanPrice.value = plan.price.toString();
      if (formPlanTitle) formPlanTitle.textContent = 'Editar Plan de Membresía';
      if (btnCancelEditPlan) btnCancelEditPlan.classList.remove('hidden');
      if (btnSubmitPlanText) btnSubmitPlanText.textContent = 'Guardar';
      inputNewPlanName?.focus();
    }
    return;
  }

  // 3. Usar plan en el formulario de socio
  const useBtn = (e.target as HTMLElement).closest('button[data-use-plan]') as HTMLButtonElement | null;
  if (useBtn) {
    const name = useBtn.getAttribute('data-use-plan');
    const price = useBtn.getAttribute('data-use-price');
    const planInput = document.getElementById('socio-plan') as HTMLInputElement | null;
    const priceInput = document.getElementById('socio-precio') as HTMLInputElement | null;
    if (planInput && name) planInput.value = name;
    if (priceInput && price) priceInput.value = price;
    closeModal(modalPlans);
    openModal(modalSocio);
  }
});

// Event Delegation para chips de plan y precio rápido en el formulario de socio
document.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest('.plan-quick-chip') as HTMLButtonElement | null;
  if (chip) {
    const name = chip.getAttribute('data-name');
    const price = chip.getAttribute('data-price');
    const duration = Number(chip.getAttribute('data-duration')) || 30;

    const planInput = document.getElementById('socio-plan') as HTMLInputElement | null;
    const priceInput = document.getElementById('socio-precio') as HTMLInputElement | null;
    const startInput = document.getElementById('socio-fecha-inicio') as HTMLInputElement | null;
    const endInput = document.getElementById('socio-fecha-fin') as HTMLInputElement | null;

    if (planInput && name) planInput.value = name;
    if (priceInput && price) priceInput.value = price;

    // Si se está creando un socio nuevo y se toca un plan con duración específica (ej. 365 días), recalcular fecha fin
    const idInput = document.getElementById('socio-id') as HTMLInputElement | null;
    if (idInput && !idInput.value && startInput && endInput && startInput.value) {
      const d = new Date(startInput.value);
      d.setDate(d.getDate() + duration);
      endInput.value = d.toISOString().split('T')[0];
    }
  }

  // Chips de precio rápido ($25, $35, $50, $65, $100, $450)
  const priceBtn = (e.target as HTMLElement).closest('.btn-quick-price') as HTMLButtonElement | null;
  if (priceBtn) {
    const price = priceBtn.getAttribute('data-price');
    const priceInput = document.getElementById('socio-precio') as HTMLInputElement | null;
    if (priceInput && price) priceInput.value = price;
  }
});

/* ==============================================================================
 * FORMULARIO DE SOCIOS (REGISTRAR / EDITAR)
 * ============================================================================== */

function prepareSocioModalForCreate() {
  if (!formSocio) return;
  formSocio.reset();
  (document.getElementById('socio-id') as HTMLInputElement).value = '';
  if (modalSocioTitle) modalSocioTitle.textContent = 'Registrar Nuevo Socio';

  // Fechas por defecto: inicio hoy, fin en 30 días
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = getRelativeDateStr(30);

  const startInput = document.getElementById('socio-fecha-inicio') as HTMLInputElement | null;
  const endInput = document.getElementById('socio-fecha-fin') as HTMLInputElement | null;
  const planInput = document.getElementById('socio-plan') as HTMLInputElement | null;
  const priceInput = document.getElementById('socio-precio') as HTMLInputElement | null;

  if (startInput) startInput.value = today;
  if (endInput) endInput.value = nextMonth;

  // Pre-llenar con el primer plan disponible del catálogo de planes
  if (plansCatalog.length > 0) {
    if (planInput) planInput.value = plansCatalog[0].name;
    if (priceInput) priceInput.value = plansCatalog[0].price.toString();
  } else {
    if (planInput) planInput.value = 'Pase Libre Full';
    if (priceInput) priceInput.value = '45000';
  }
}

function prepareSocioModalForEdit(socio: Socio) {
  if (!formSocio) return;
  if (modalSocioTitle) modalSocioTitle.textContent = 'Editar Socio';

  (document.getElementById('socio-id') as HTMLInputElement).value = socio.id;
  (document.getElementById('socio-nombre') as HTMLInputElement).value = socio.nombre;
  (document.getElementById('socio-email') as HTMLInputElement).value = socio.email;
  (document.getElementById('socio-telefono') as HTMLInputElement).value = socio.telefono;
  (document.getElementById('socio-plan') as HTMLInputElement).value = socio.plan;
  (document.getElementById('socio-precio') as HTMLInputElement).value = socio.precio.toString();
  (document.getElementById('socio-fecha-inicio') as HTMLInputElement).value = socio.fecha_inicio;
  (document.getElementById('socio-fecha-fin') as HTMLInputElement).value = socio.fecha_fin;

  openModal(modalSocio);
}

// Envío del formulario de socios -> Guarda directamente en Firestore
formSocio?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = (document.getElementById('socio-id') as HTMLInputElement).value;
  const nombre = (document.getElementById('socio-nombre') as HTMLInputElement).value.trim();
  const email = (document.getElementById('socio-email') as HTMLInputElement).value.trim();
  const telefono = (document.getElementById('socio-telefono') as HTMLInputElement).value.trim();
  const plan = (document.getElementById('socio-plan') as HTMLInputElement).value.trim() || 'Pase Libre Full';
  const precio = Number((document.getElementById('socio-precio') as HTMLInputElement).value) || 0;
  const fecha_inicio = (document.getElementById('socio-fecha-inicio') as HTMLInputElement).value;
  const fecha_fin = (document.getElementById('socio-fecha-fin') as HTMLInputElement).value;

  const saveBtn = document.getElementById('btn-save-socio') as HTMLButtonElement | null;
  const originalSaveText = saveBtn?.innerHTML || 'Guardar Socio';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5"></span> Guardando...';
  }

  try {
    const estado = determineStatusByDate(fecha_fin);

    if (id) {
      // Actualizar en Firestore
      await updateSocioInFirestore(id, {
        nombre,
        email,
        telefono,
        plan,
        precio,
        fecha_inicio,
        fecha_fin,
        estado
      });
      showToast('Socio actualizado', `Se guardaron los cambios para ${nombre}.`);
    } else {
      // Crear en Firestore
      await addSocioToFirestore({
        nombre,
        email,
        telefono,
        plan,
        precio,
        fecha_inicio,
        fecha_fin,
        estado,
        notas: `Registrado por admin con cuota de ${formatPesos(precio)}.`
      });
      showToast('Socio registrado', `Se dio de alta a ${nombre} exitosamente.`);
    }

    closeModal(modalSocio);
  } catch (err) {
    console.error('Error al guardar socio en Firebase Firestore:', err);
    showToast('Error', 'Ocurrió un error al guardar en Firestore.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalSaveText;
    }
  }
});

/* ==============================================================================
 * RENDERIZADO DE SOCIOS Y ESTADOS VISUALES
 * ============================================================================== */

function determineStatusByDate(fechaFinStr: string): EstadoSocio {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(fechaFinStr + 'T00:00:00');
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'vencido';
  if (diffDays <= 7) return 'por_vencer';
  return 'activo';
}

function getDaysRemaining(fechaFinStr: string): { days: number; text: string; isPast: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(fechaFinStr + 'T00:00:00');
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { days, text: `Venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`, isPast: true };
  } else if (days === 0) {
    return { days, text: 'Vence hoy', isPast: false };
  } else if (days === 1) {
    return { days, text: 'Vence mañana', isPast: false };
  } else {
    return { days, text: `Quedan ${days} días`, isPast: false };
  }
}

function getStatusBadgeHTML(estado: EstadoSocio): string {
  switch (estado) {
    case 'activo':
      return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Activo
        </span>
      `;
    case 'por_vencer':
      return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Por Vencer
        </span>
      `;
    case 'vencido':
      return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          Vencido
        </span>
      `;
  }
}

function getAvatarGradient(nombre: string): string {
  const palettes = [
    'from-emerald-600 to-teal-700 text-white',
    'from-indigo-600 to-purple-700 text-white',
    'from-blue-600 to-cyan-700 text-white',
    'from-amber-600 to-orange-700 text-white',
    'from-rose-600 to-pink-700 text-white'
  ];
  let sum = 0;
  for (let i = 0; i < nombre.length; i++) sum += nombre.charCodeAt(i);
  return palettes[sum % palettes.length];
}

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('');
}

function renderSocios(sociosList: Socio[]) {
  // Aplicar filtros de estado y buscador
  const filtered = sociosList.filter(socio => {
    if (currentFilter !== 'all' && socio.estado !== currentFilter) {
      return false;
    }
    if (currentSearchQuery) {
      const q = currentSearchQuery.toLowerCase();
      const matchName = socio.nombre.toLowerCase().includes(q);
      const matchEmail = socio.email.toLowerCase().includes(q);
      const matchPhone = socio.telefono.toLowerCase().includes(q);
      const matchPlan = socio.plan.toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchPlan;
    }
    return true;
  });

  // A. Actualizar Tabla Desktop
  if (tableBody) {
    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      tableEmptyState?.classList.remove('hidden');
    } else {
      tableEmptyState?.classList.add('hidden');
      tableBody.innerHTML = filtered.map(socio => {
        const remaining = getDaysRemaining(socio.fecha_fin);
        const avatarColor = getAvatarGradient(socio.nombre);
        const initials = getInitials(socio.nombre);

        return `
          <tr class="hover:bg-slate-800/40 transition-colors group">
            <!-- Socio: Avatar y Contacto -->
            <td class="py-3.5 px-5">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                  ${initials}
                </div>
                <div class="min-w-0">
                  <p class="font-bold text-white text-sm truncate">${escapeHtml(socio.nombre)}</p>
                  <p class="text-xs text-slate-400 truncate">${escapeHtml(socio.email)}</p>
                </div>
              </div>
            </td>

            <!-- Plan y Cuota -->
            <td class="py-3.5 px-4">
              <p class="font-medium text-slate-200 text-xs sm:text-sm">${escapeHtml(socio.plan)}</p>
              <p class="text-[11px] text-emerald-400 font-mono font-semibold">${formatPesos(socio.precio)} <span class="text-slate-500 font-normal">/ mes</span></p>
            </td>

            <!-- Fecha de Vencimiento -->
            <td class="py-3.5 px-4">
              <p class="text-xs font-semibold text-slate-300 font-mono">${formatDate(socio.fecha_fin)}</p>
              <p class="text-[11px] font-medium ${remaining.isPast ? 'text-rose-400 font-semibold' : 'text-slate-400'}">
                ${remaining.text}
              </p>
            </td>

            <!-- Estado Visual -->
            <td class="py-3.5 px-4 text-center">
              ${getStatusBadgeHTML(socio.estado)}
            </td>

            <!-- Acciones Rápidas -->
            <td class="py-3.5 px-5 text-right">
              <div class="inline-flex items-center gap-1.5">
                <button 
                  data-action="checkin" 
                  data-id="${socio.id}"
                  title="Marcar Asistencia en Portería"
                  class="p-1.5 rounded-lg text-teal-400 hover:bg-teal-500/10 border border-teal-500/20 transition-colors"
                >
                  <i data-lucide="user-check" class="w-4 h-4"></i>
                </button>
                <button 
                  data-action="pay" 
                  data-id="${socio.id}"
                  title="Registrar Cobro de Cuota"
                  class="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                >
                  <i data-lucide="dollar-sign" class="w-4 h-4"></i>
                </button>
                <button 
                  data-action="renew" 
                  data-id="${socio.id}"
                  title="Renovar (+30 días)"
                  class="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                >
                  <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                </button>
                <button 
                  data-action="edit" 
                  data-id="${socio.id}"
                  title="Editar socio"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button 
                  data-action="delete" 
                  data-id="${socio.id}"
                  title="Eliminar de Firestore"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // B. Actualizar Tarjetas Móviles (Mobile Cards)
  if (cardsContainer) {
    if (filtered.length === 0) {
      cardsContainer.innerHTML = '';
      cardsEmptyState?.classList.remove('hidden');
    } else {
      cardsEmptyState?.classList.add('hidden');
      cardsContainer.innerHTML = filtered.map(socio => {
        const remaining = getDaysRemaining(socio.fecha_fin);
        const avatarColor = getAvatarGradient(socio.nombre);
        const initials = getInitials(socio.nombre);
        const cleanPhone = socio.telefono.replace(/[^\d+]/g, '');

        return `
          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-3">
            
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                  ${initials}
                </div>
                <div class="min-w-0">
                  <h4 class="font-bold text-white text-base truncate">${escapeHtml(socio.nombre)}</h4>
                  <p class="text-xs text-emerald-400 font-medium">${escapeHtml(socio.plan)}</p>
                </div>
              </div>
              <div class="shrink-0">
                ${getStatusBadgeHTML(socio.estado)}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div class="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50">
                <span class="text-[10px] uppercase font-bold text-slate-500 block">Vencimiento</span>
                <span class="font-mono font-semibold text-slate-200">${formatDate(socio.fecha_fin)}</span>
                <span class="block text-[11px] ${remaining.isPast ? 'text-rose-400 font-bold' : 'text-slate-400'}">${remaining.text}</span>
              </div>
              <div class="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50">
                <span class="text-[10px] uppercase font-bold text-slate-500 block">Cuota Mensual</span>
                <span class="font-bold text-emerald-400 text-sm">${formatPesos(socio.precio)}</span>
                <span class="block text-[11px] text-slate-400 truncate">${escapeHtml(socio.email)}</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button 
                data-action="checkin" 
                data-id="${socio.id}"
                class="flex-1 py-2 px-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                title="Marcar Asistencia"
              >
                <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
                <span>Check-in</span>
              </button>

              <button 
                data-action="pay" 
                data-id="${socio.id}"
                class="flex-1 py-2 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all"
                title="Cobrar Cuota"
              >
                <i data-lucide="dollar-sign" class="w-3.5 h-3.5"></i>
                <span>Cobrar</span>
              </button>

              <button 
                data-action="renew" 
                data-id="${socio.id}"
                class="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors active:scale-95"
                title="Renovar (+30d)"
              >
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-emerald-400"></i>
              </button>

              <a 
                href="https://wa.me/${cleanPhone}" 
                target="_blank" 
                rel="noopener" 
                class="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors active:scale-95"
                title="Mensaje WhatsApp"
              >
                <i data-lucide="message-circle" class="w-4 h-4 text-emerald-400"></i>
              </a>

              <button 
                data-action="edit" 
                data-id="${socio.id}"
                class="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors active:scale-95"
                title="Editar socio"
              >
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>

              <button 
                data-action="delete" 
                data-id="${socio.id}"
                class="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700 flex items-center justify-center transition-colors active:scale-95"
                title="Eliminar de Firestore"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>

          </div>
        `;
      }).join('');
    }
  }

  if (window.lucide) window.lucide.createIcons();
  updateDashboardMetrics(sociosList);
}

// Delegación de eventos para acciones en tabla y tarjetas móviles
async function handleSocioActionClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
  if (!target) return;

  const action = target.getAttribute('data-action');
  const id = target.getAttribute('data-id');
  if (!id) return;

  const socio = sociosState.find(s => s.id === id);
  if (!socio) return;

  if (action === 'renew') {
    // Calcular nueva fecha de fin (+30 días a partir de hoy o de la fecha actual si aún no vence)
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 30);
    const newFechaFin = baseDate.toISOString().split('T')[0];

    target.disabled = true;
    try {
      await updateSocioInFirestore(id, {
        fecha_fin: newFechaFin,
        estado: 'activo'
      });
      showToast('Membresía renovada', `${socio.nombre} está activo por 30 días más.`);
    } catch (err) {
      console.error('Error al renovar socio en Firestore:', err);
      showToast('Error', 'No se pudo renovar la membresía.', 'error');
    } finally {
      target.disabled = false;
    }
  } else if (action === 'checkin') {
    prepareAttendanceModalForCreate(socio);
    openModal(modalAttendance);
  } else if (action === 'pay') {
    prepareTransactionModalForCreate({
      tipo: 'ingreso',
      concepto: `Cuota mensual - ${socio.nombre}`,
      monto: socio.precio,
      socioNombre: socio.nombre,
      categoria: 'Cuotas Membresía'
    });
    openModal(modalTransaction);
  } else if (action === 'edit') {
    prepareSocioModalForEdit(socio);
  } else if (action === 'delete') {
    requestConfirmation({
      title: '¿Eliminar socio del gimnasio?',
      itemType: 'Socio',
      itemName: socio.nombre,
      itemDesc: `Plan: ${socio.plan} • Estado: ${socio.estado.toUpperCase()} • Vence: ${formatDate(socio.fecha_fin)}`,
      warning: 'Se dará de baja la ficha completa del socio y ya no figurará en el listado de membresías ni en portería.',
      confirmBtnText: 'Sí, Eliminar Socio',
      onConfirm: async () => {
        await deleteSocioFromFirestore(id);
        showToast('Socio eliminado', `"${socio.nombre}" fue eliminado del sistema.`);
      }
    });
  }
}

tableBody?.addEventListener('click', handleSocioActionClick);
cardsContainer?.addEventListener('click', handleSocioActionClick);

// Buscador en tiempo real
searchInput?.addEventListener('input', (e) => {
  currentSearchQuery = (e.target as HTMLInputElement).value;
  renderSocios(sociosState);
});

// Filtros interactivos del Dashboard y la Tabla
function applyFilter(filter: 'all' | EstadoSocio, shouldScroll = false) {
  currentFilter = filter;

  // 1. Sincronizar botones segmentados
  statusFilterButtons.forEach(b => {
    const btnFilter = b.getAttribute('data-filter');
    if (btnFilter === filter) {
      b.classList.remove('bg-slate-800/80', 'text-slate-300');
      b.classList.add('bg-emerald-500', 'text-slate-950', 'font-bold', 'shadow-md', 'shadow-emerald-500/20');
    } else {
      b.classList.remove('bg-emerald-500', 'text-slate-950', 'font-bold', 'shadow-md', 'shadow-emerald-500/20');
      b.classList.add('bg-slate-800/80', 'text-slate-300');
    }
  });

  // 2. Sincronizar tarjetas métricas interactivas del Dashboard
  metricInteractiveCards.forEach(card => {
    const cardCategory = card.getAttribute('data-filter-card');
    const badge = card.querySelector<HTMLElement>('.metric-card-badge');
    const isSelected = (cardCategory === filter);

    // Remover anillos y brillos previos
    card.classList.remove(
      'ring-2', 'ring-offset-2', 'ring-offset-slate-950',
      'ring-emerald-500', 'border-emerald-500', 'shadow-emerald-500/20',
      'ring-amber-500', 'border-amber-500', 'shadow-amber-500/20',
      'ring-rose-500', 'border-rose-500', 'shadow-rose-500/20',
      'ring-teal-500', 'border-teal-500', 'shadow-teal-500/20'
    );

    if (isSelected && filter !== 'all') {
      card.classList.add('ring-2', 'ring-offset-2', 'ring-offset-slate-950');
      if (filter === 'activo') {
        card.classList.add('ring-emerald-500', 'border-emerald-500', 'shadow-lg', 'shadow-emerald-500/20');
      } else if (filter === 'por_vencer') {
        card.classList.add('ring-amber-500', 'border-amber-500', 'shadow-lg', 'shadow-amber-500/20');
      } else if (filter === 'vencido') {
        card.classList.add('ring-rose-500', 'border-rose-500', 'shadow-lg', 'shadow-rose-500/20');
      }

      if (badge) {
        badge.innerHTML = '<i data-lucide="check" class="w-2.5 h-2.5"></i> Filtrando';
        badge.className = 'metric-card-badge inline-flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shadow-sm ' + 
          (filter === 'activo' ? 'bg-emerald-500 text-slate-950' :
           filter === 'por_vencer' ? 'bg-amber-500 text-slate-950' :
           'bg-rose-500 text-white');
      }
    } else {
      // Estado normal
      if (badge) {
        if (cardCategory === 'all') {
          badge.innerHTML = '<i data-lucide="list" class="w-2.5 h-2.5"></i> Ver Todos';
          badge.className = 'metric-card-badge inline-flex items-center gap-0.5 font-semibold text-[10px] uppercase tracking-wider bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400 group-hover:text-teal-300';
        } else {
          badge.innerHTML = '<i data-lucide="filter" class="w-2.5 h-2.5"></i> Filtrar';
          badge.className = 'metric-card-badge inline-flex items-center gap-0.5 font-semibold text-[10px] uppercase tracking-wider bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400 ' + 
            (cardCategory === 'activo' ? 'group-hover:text-emerald-300' :
             cardCategory === 'por_vencer' ? 'group-hover:text-amber-300' :
             'group-hover:text-rose-300');
        }
      }
    }
  });

  // 3. Indicador de Filtro Activo sobre el listado de socios
  if (filterActiveIndicator && filterActiveName) {
    if (filter === 'all') {
      filterActiveIndicator.classList.add('hidden');
      filterActiveIndicator.classList.remove('inline-flex');
    } else {
      filterActiveIndicator.classList.remove('hidden');
      filterActiveIndicator.classList.add('inline-flex');

      if (filter === 'activo') {
        filterActiveName.textContent = 'Activos';
        filterActiveIndicator.className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold inline-flex items-center gap-1.5 animate-in fade-in';
      } else if (filter === 'por_vencer') {
        filterActiveName.textContent = 'Por Vencer';
        filterActiveIndicator.className = 'text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold inline-flex items-center gap-1.5 animate-in fade-in';
      } else if (filter === 'vencido') {
        filterActiveName.textContent = 'Vencidos';
        filterActiveIndicator.className = 'text-xs px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold inline-flex items-center gap-1.5 animate-in fade-in';
      }
    }
  }

  // 4. Renderizar socios filtrados
  renderSocios(sociosState);

  // 5. Desplazamiento suave al listado si se activó desde una tarjeta del dashboard
  if (shouldScroll) {
    const sociosSection = document.getElementById('socios-section');
    if (sociosSection) {
      sociosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

// Interactividad en tarjetas métricas del Dashboard (clic y teclado accesible)
metricInteractiveCards.forEach(card => {
  const handleCardInteraction = () => {
    const category = card.getAttribute('data-filter-card') as 'all' | EstadoSocio;
    if (!category) return;

    // Toggle: si ya está filtrando por esa misma categoría, volver a 'all'
    if (currentFilter === category && category !== 'all') {
      applyFilter('all', true);
    } else {
      applyFilter(category, true);
    }
  };

  card.addEventListener('click', handleCardInteraction);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardInteraction();
    }
  });
});

// Filtros de estado tradicionales (Todos, Activos, Por Vencer, Vencidos)
statusFilterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.getAttribute('data-filter') as 'all' | EstadoSocio;
    applyFilter(filter, false);
  });
});

// Botón para quitar filtro activo (botón "x" en la píldora)
btnClearFilter?.addEventListener('click', (e) => {
  e.stopPropagation();
  applyFilter('all', false);
});

/* ==============================================================================
 * CÁLCULO DE KPIS DEL DASHBOARD & ESTADÍSTICAS EN VIVO
 * ============================================================================== */

function updateDashboardMetrics(allSocios: Socio[]) {
  const activos = allSocios.filter(s => s.estado === 'activo').length;
  const porVencer = allSocios.filter(s => s.estado === 'por_vencer').length;
  const vencidos = allSocios.filter(s => s.estado === 'vencido').length;

  // Total de ingresos calculado a partir de las cuotas fijadas por el admin
  const totalIncome = allSocios
    .filter(s => s.estado === 'activo' || s.estado === 'por_vencer')
    .reduce((acc, curr) => acc + (Number(curr.precio) || 0), 0);

  if (metricActiveCount) metricActiveCount.textContent = activos.toString();
  if (metricExpiringCount) metricExpiringCount.textContent = porVencer.toString();
  if (metricIncomeAmount) metricIncomeAmount.textContent = formatPesos(totalIncome);
  if (badgeTotalSocios) badgeTotalSocios.textContent = `${allSocios.length} registrados`;

  if (filterCountAll) filterCountAll.textContent = allSocios.length.toString();
  if (filterCountActivo) filterCountActivo.textContent = activos.toString();
  if (filterCountPorVencer) filterCountPorVencer.textContent = porVencer.toString();
  if (filterCountVencido) filterCountVencido.textContent = vencidos.toString();
}

/* ==============================================================================
 * GENERACIÓN Y DESCARGA DE REPORTE MENSUAL EN PDF
 * ============================================================================== */
btnDownloadPdfReport?.addEventListener('click', () => {
  const activos = sociosState.filter(s => s.estado === 'activo').length;
  const porVencer = sociosState.filter(s => s.estado === 'por_vencer').length;
  const vencidos = sociosState.filter(s => s.estado === 'vencido').length;
  const totalIncome = sociosState
    .filter(s => s.estado === 'activo' || s.estado === 'por_vencer')
    .reduce((acc, curr) => acc + (Number(curr.precio) || 0), 0);

  const originalContent = btnDownloadPdfReport.innerHTML;
  btnDownloadPdfReport.innerHTML = `
    <span class="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mr-1.5"></span>
    <span>Generando PDF...</span>
  `;
  (btnDownloadPdfReport as HTMLButtonElement).disabled = true;

  try {
    generateMonthlyPDFReport(sociosState, {
      totalSocios: sociosState.length,
      activos,
      porVencer,
      vencidos,
      totalIncome,
      businessName: 'Titan Fitness Center'
    });
  } catch (err) {
    console.error('Error generando reporte PDF:', err);
  } finally {
    setTimeout(() => {
      btnDownloadPdfReport.innerHTML = originalContent;
      (btnDownloadPdfReport as HTMLButtonElement).disabled = false;
      if (window.lucide) window.lucide.createIcons();
    }, 1000);
  }
});

/* ==============================================================================
 * GESTIÓN FINANCIERA: INGRESOS & GASTOS (MOVIMIENTOS DE CAJA)
 * 100% Interactivo: Crear, Editar, Eliminar y Sincronizar en Tiempo Real
 * ============================================================================== */

function updateFinanzasKPIs() {
  const totalIngresos = transactionsState
    .filter(t => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + (Number(t.monto) || 0), 0);

  const totalGastos = transactionsState
    .filter(t => t.tipo === 'gasto')
    .reduce((sum, t) => sum + (Number(t.monto) || 0), 0);

  const balanceNeto = totalIngresos - totalGastos;

  if (finanzasTotalIngresos) finanzasTotalIngresos.textContent = formatPesos(totalIngresos);
  if (finanzasTotalGastos) finanzasTotalGastos.textContent = formatPesos(totalGastos);
  if (finanzasBalanceNeto) finanzasBalanceNeto.textContent = formatPesos(balanceNeto);

  if (badgeTotalTransactions) {
    badgeTotalTransactions.textContent = `${transactionsState.length} movimiento${transactionsState.length === 1 ? '' : 's'}`;
  }

  if (finanzasBalanceBadge) {
    if (balanceNeto >= 0) {
      finanzasBalanceBadge.textContent = 'Superávit';
      finanzasBalanceBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    } else {
      finanzasBalanceBadge.textContent = 'Déficit';
      finanzasBalanceBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
  }

  const countIngresos = transactionsState.filter(t => t.tipo === 'ingreso').length;
  const countGastos = transactionsState.filter(t => t.tipo === 'gasto').length;
  if (txCountAll) txCountAll.textContent = transactionsState.length.toString();
  if (txCountIngresos) txCountIngresos.textContent = countIngresos.toString();
  if (txCountGastos) txCountGastos.textContent = countGastos.toString();
}

function renderTransactions() {
  const filtered = transactionsState.filter(tx => {
    if (currentTxFilter !== 'all' && tx.tipo !== currentTxFilter) {
      return false;
    }
    if (currentTxSearchQuery) {
      const q = currentTxSearchQuery.toLowerCase();
      const matchConcepto = tx.concepto.toLowerCase().includes(q);
      const matchCat = tx.categoria.toLowerCase().includes(q);
      const matchMetodo = tx.metodo.toLowerCase().includes(q);
      const matchSocio = (tx.socioNombre || '').toLowerCase().includes(q);
      return matchConcepto || matchCat || matchMetodo || matchSocio;
    }
    return true;
  });

  // A. Tabla Desktop
  if (transactionsTableBody) {
    if (filtered.length === 0) {
      transactionsTableBody.innerHTML = '';
      transactionsEmptyState?.classList.remove('hidden');
    } else {
      transactionsEmptyState?.classList.add('hidden');
      transactionsTableBody.innerHTML = filtered.map(tx => {
        const isIngreso = tx.tipo === 'ingreso';
        const typeBadge = isIngreso
          ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i data-lucide="arrow-down-left" class="w-3.5 h-3.5"></i> Ingreso</span>`
          : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"><i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i> Gasto</span>`;

        const amountClass = isIngreso ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
        const sign = isIngreso ? '+' : '-';

        return `
          <tr class="hover:bg-slate-800/40 transition-colors group">
            <td class="py-3.5 px-5">${typeBadge}</td>
            <td class="py-3.5 px-4">
              <p class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(tx.concepto)}</p>
              ${tx.socioNombre ? `<p class="text-[11px] text-teal-400 flex items-center gap-1 mt-0.5"><i data-lucide="user" class="w-3 h-3"></i> ${escapeHtml(tx.socioNombre)}</p>` : ''}
            </td>
            <td class="py-3.5 px-4">
              <span class="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-300">
                ${escapeHtml(tx.categoria)}
              </span>
            </td>
            <td class="py-3.5 px-4 text-xs text-slate-300 font-mono">
              ${formatDate(tx.fecha)}
            </td>
            <td class="py-3.5 px-4 text-xs text-slate-400">
              ${escapeHtml(tx.metodo)}
            </td>
            <td class="py-3.5 px-4 text-right">
              <span class="font-mono text-sm ${amountClass}">
                ${sign}${formatPesos(tx.monto)}
              </span>
            </td>
            <td class="py-3.5 px-5 text-right">
              <div class="inline-flex items-center gap-1">
                <button 
                  data-action="edit-tx" 
                  data-id="${tx.id}"
                  title="Editar movimiento"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button 
                  data-action="delete-tx" 
                  data-id="${tx.id}"
                  title="Borrar de forma instantánea (1 clic)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // B. Tarjetas Móviles
  if (transactionsCardsContainer) {
    transactionsCardsContainer.innerHTML = filtered.map(tx => {
      const isIngreso = tx.tipo === 'ingreso';
      const typeBadge = isIngreso
        ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i data-lucide="arrow-down-left" class="w-3 h-3"></i> Ingreso</span>`
        : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"><i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i> Gasto</span>`;

      const amountClass = isIngreso ? 'text-emerald-400' : 'text-rose-400';
      const sign = isIngreso ? '+' : '-';

      return `
        <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2.5 text-xs">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                ${typeBadge}
                <span class="text-[10px] text-slate-500 font-mono">${formatDate(tx.fecha)}</span>
              </div>
              <h4 class="font-bold text-white text-sm truncate">${escapeHtml(tx.concepto)}</h4>
              ${tx.socioNombre ? `<p class="text-[11px] text-teal-400 mt-0.5">Socio: ${escapeHtml(tx.socioNombre)}</p>` : ''}
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono font-extrabold text-base ${amountClass}">
                ${sign}${formatPesos(tx.monto)}
              </span>
              <p class="text-[10px] text-slate-400">${escapeHtml(tx.metodo)}</p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span class="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-400">
              ${escapeHtml(tx.categoria)}
            </span>
            <div class="flex items-center gap-1">
              <button 
                data-action="edit-tx" 
                data-id="${tx.id}"
                class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 active:scale-95"
              >
                <i data-lucide="edit-3" class="w-3 h-3"></i> Editar
              </button>
              <button 
                data-action="delete-tx" 
                data-id="${tx.id}"
                title="Borrar de forma instantánea"
                class="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700 active:scale-95 flex items-center gap-1 text-xs"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Borrar
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) window.lucide.createIcons();
  updateFinanzasKPIs();
}

function prepareTransactionModalForCreate(prefill?: {
  tipo?: 'ingreso' | 'gasto';
  concepto?: string;
  monto?: number;
  socioNombre?: string;
  categoria?: string;
}) {
  if (!formTransaction) return;
  formTransaction.reset();

  const idInput = document.getElementById('tx-id') as HTMLInputElement | null;
  if (idInput) idInput.value = '';

  if (modalTransactionTitle) modalTransactionTitle.textContent = 'Registrar Movimiento Financiero';

  if (btnDeleteModalTransaction) {
    btnDeleteModalTransaction.classList.add('hidden');
    btnDeleteModalTransaction.classList.remove('inline-flex');
  }

  const tipo = prefill?.tipo || 'ingreso';
  const radio = formTransaction.querySelector(`input[name="tx-tipo"][value="${tipo}"]`) as HTMLInputElement | null;
  if (radio) radio.checked = true;

  const conceptoInput = document.getElementById('tx-concepto') as HTMLInputElement | null;
  if (conceptoInput && prefill?.concepto) conceptoInput.value = prefill.concepto;

  const montoInput = document.getElementById('tx-monto') as HTMLInputElement | null;
  if (montoInput && prefill?.monto) montoInput.value = prefill.monto.toString();

  const fechaInput = document.getElementById('tx-fecha') as HTMLInputElement | null;
  if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];

  const socioInput = document.getElementById('tx-socio-nombre') as HTMLInputElement | null;
  if (socioInput && prefill?.socioNombre) socioInput.value = prefill.socioNombre;

  const categoriaSelect = document.getElementById('tx-categoria') as HTMLSelectElement | null;
  if (categoriaSelect && prefill?.categoria) categoriaSelect.value = prefill.categoria;

  // Actualizar datalist de socios
  if (txSociosDatalist) {
    txSociosDatalist.innerHTML = sociosState.map(s => `
      <option value="${escapeHtml(s.nombre)}">${escapeHtml(s.plan)} (${formatPesos(s.precio)})</option>
    `).join('');
  }
}

function prepareTransactionModalForEdit(tx: Transaction) {
  if (!formTransaction) return;
  if (modalTransactionTitle) modalTransactionTitle.textContent = 'Editar Movimiento Financiero';

  if (btnDeleteModalTransaction) {
    btnDeleteModalTransaction.classList.remove('hidden');
    btnDeleteModalTransaction.classList.add('inline-flex');
  }

  const idInput = document.getElementById('tx-id') as HTMLInputElement | null;
  if (idInput) idInput.value = tx.id;

  const radio = formTransaction.querySelector(`input[name="tx-tipo"][value="${tx.tipo}"]`) as HTMLInputElement | null;
  if (radio) radio.checked = true;

  const conceptoInput = document.getElementById('tx-concepto') as HTMLInputElement | null;
  if (conceptoInput) conceptoInput.value = tx.concepto;

  const montoInput = document.getElementById('tx-monto') as HTMLInputElement | null;
  if (montoInput) montoInput.value = tx.monto.toString();

  const categoriaSelect = document.getElementById('tx-categoria') as HTMLSelectElement | null;
  if (categoriaSelect) categoriaSelect.value = tx.categoria;

  const fechaInput = document.getElementById('tx-fecha') as HTMLInputElement | null;
  if (fechaInput) fechaInput.value = tx.fecha;

  const metodoSelect = document.getElementById('tx-metodo') as HTMLSelectElement | null;
  if (metodoSelect) metodoSelect.value = tx.metodo;

  const socioInput = document.getElementById('tx-socio-nombre') as HTMLInputElement | null;
  if (socioInput) socioInput.value = tx.socioNombre || '';

  // Actualizar datalist de socios
  if (txSociosDatalist) {
    txSociosDatalist.innerHTML = sociosState.map(s => `
      <option value="${escapeHtml(s.nombre)}">${escapeHtml(s.plan)} (${formatPesos(s.precio)})</option>
    `).join('');
  }

  openModal(modalTransaction);
}

// Envío del Formulario de Movimiento Financiero -> Guarda o Edita en Firestore
formTransaction?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idInput = document.getElementById('tx-id') as HTMLInputElement | null;
  const id = idInput?.value;

  const tipo = ((formTransaction.querySelector('input[name="tx-tipo"]:checked') as HTMLInputElement)?.value as 'ingreso' | 'gasto') || 'ingreso';
  const concepto = (document.getElementById('tx-concepto') as HTMLInputElement)?.value.trim() || '';
  const monto = Number((document.getElementById('tx-monto') as HTMLInputElement)?.value) || 0;
  const categoria = (document.getElementById('tx-categoria') as HTMLSelectElement)?.value || 'Cuotas Membresía';
  const fecha = (document.getElementById('tx-fecha') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
  const metodo = (document.getElementById('tx-metodo') as HTMLSelectElement)?.value || 'Transferencia';
  const socioNombre = (document.getElementById('tx-socio-nombre') as HTMLInputElement)?.value.trim() || undefined;

  const submitBtn = document.getElementById('btn-save-transaction') as HTMLButtonElement | null;
  const originalText = submitBtn?.innerHTML || 'Guardar Movimiento';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5"></span> Guardando...';
  }

  try {
    if (id) {
      await updateTransactionInFirestore(id, {
        tipo,
        concepto,
        monto,
        categoria,
        fecha,
        metodo,
        socioNombre
      });
      showToast('Movimiento actualizado', `Se guardaron los cambios de "${concepto}".`);
    } else {
      await addTransactionToFirestore({
        tipo,
        concepto,
        monto,
        categoria,
        fecha,
        metodo,
        socioNombre
      });
      showToast('Movimiento registrado', `Se registró "${concepto}" por ${formatPesos(monto)}.`);
    }
    closeModal(modalTransaction);
  } catch (err) {
    console.error('Error al guardar movimiento financiero:', err);
    showToast('Error', 'No se pudo guardar el movimiento financiero.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
});

/**
 * Borra un movimiento financiero de forma 100% instantánea:
 * - Sin carteles ni modales bloqueantes
 * - Eliminación optimista en 0ms en la interfaz y estadísticas
 * - Notificación toast interactiva con opción de "Deshacer"
 * - Sincronización en segundo plano con Firestore
 */
async function deleteMovementInstant(id: string) {
  const tx = transactionsState.find(t => t.id === id);
  if (!tx) return;

  const txBackup = { ...tx };

  // 1. Eliminación optimista inmediata del estado local (0ms de respuesta)
  transactionsState = transactionsState.filter(t => t.id !== id);
  renderTransactions();

  // 2. Cerrar modal de transacción si estaba abierto
  closeModal(modalTransaction);

  // 3. Notificación con acción interactiva para Deshacer
  showToastWithAction(
    '⚡ Movimiento eliminado al instante',
    `"${txBackup.concepto}" (${formatPesos(txBackup.monto)}) fue eliminado de caja.`,
    'Deshacer',
    async () => {
      try {
        const { id: _, ...rest } = txBackup;
        await addTransactionToFirestore(rest);
        showToast('Movimiento Restaurado', `"${txBackup.concepto}" se ha recuperado con éxito.`);
      } catch (err) {
        console.error('Error al restaurar movimiento:', err);
        showToast('Error', 'No se pudo restaurar el movimiento.', 'error');
      }
    }
  );

  // 4. Eliminación en Firestore en segundo plano
  try {
    await deleteTransactionFromFirestore(id);
  } catch (err) {
    console.error('Error al borrar movimiento de Firestore:', err);
    // Rollback en caso de falla de red o base de datos
    transactionsState = [txBackup, ...transactionsState];
    transactionsState.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    renderTransactions();
    showToast('Error de Conexión', 'No se pudo eliminar el movimiento en el servidor. Registro restaurado.', 'error');
  }
}

// Event Delegation para Acciones de Finanzas (Editar y Eliminar de Forma Instantánea)
async function handleTransactionActionClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
  if (!target) return;
  const action = target.getAttribute('data-action');
  const id = target.getAttribute('data-id');
  if (!id) return;

  const tx = transactionsState.find(t => t.id === id);
  if (!tx) return;

  if (action === 'edit-tx') {
    prepareTransactionModalForEdit(tx);
  } else if (action === 'delete-tx') {
    // Borrado instantáneo en 1 solo clic sin confirmación previa
    await deleteMovementInstant(id);
  }
}

// Botón de Borrado Instantáneo dentro del modal de edición
btnDeleteModalTransaction?.addEventListener('click', async () => {
  const idInput = document.getElementById('tx-id') as HTMLInputElement | null;
  const id = idInput?.value;
  if (id) {
    await deleteMovementInstant(id);
  }
});

transactionsTableBody?.addEventListener('click', handleTransactionActionClick);
transactionsCardsContainer?.addEventListener('click', handleTransactionActionClick);

// Filtros y Búsqueda en Finanzas
txFilterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.getAttribute('data-tx-filter') as 'all' | 'ingreso' | 'gasto';
    currentTxFilter = filter;

    txFilterButtons.forEach(b => {
      if (b.getAttribute('data-tx-filter') === filter) {
        b.className = 'tx-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 text-slate-950 transition-colors whitespace-nowrap';
      } else {
        b.className = 'tx-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition-colors whitespace-nowrap';
      }
    });

    renderTransactions();
  });
});

searchTransactionsInput?.addEventListener('input', (e) => {
  currentTxSearchQuery = (e.target as HTMLInputElement).value.trim();
  renderTransactions();
});

btnOpenNewTransactionModal?.addEventListener('click', () => {
  prepareTransactionModalForCreate();
  openModal(modalTransaction);
});
btnCloseTransactionModal?.addEventListener('click', () => closeModal(modalTransaction));
btnCancelTransaction?.addEventListener('click', () => closeModal(modalTransaction));

/* ==============================================================================
 * CONTROL DE ASISTENCIA & CHECK-INS (PORTERÍA)
 * 100% Interactivo: Registrar, Editar, Eliminar y Validar Estado de Membresía
 * ============================================================================== */

function updateAttendanceKPIs() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = attendancesState.filter(a => a.fecha === todayStr).length;

  if (attendanceTodayCount) attendanceTodayCount.textContent = todayCount.toString();
  if (attendanceTotalCount) attendanceTotalCount.textContent = attendancesState.length.toString();

  if (badgeTotalAttendances) {
    badgeTotalAttendances.textContent = `${attendancesState.length} registro${attendancesState.length === 1 ? '' : 's'}`;
  }

  // Actividad más frecuente
  if (attendanceTopActivity && attendancesState.length > 0) {
    const activityCounts: Record<string, number> = {};
    attendancesState.forEach(a => {
      const act = a.actividad || 'Musculación';
      activityCounts[act] = (activityCounts[act] || 0) + 1;
    });
    let topAct = 'Musculación';
    let max = 0;
    Object.entries(activityCounts).forEach(([act, count]) => {
      if (count > max) {
        max = count;
        topAct = act;
      }
    });
    attendanceTopActivity.textContent = topAct;
  }
}

function updateAttendanceSocioPreview(socioName: string) {
  if (!attPreviewPlan || !attPreviewBadge) return;
  const match = sociosState.find(s => s.nombre.toLowerCase() === socioName.trim().toLowerCase());
  if (match) {
    attPreviewPlan.textContent = `${match.plan} • ${formatPesos(match.precio)}`;
    if (match.estado === 'activo') {
      attPreviewBadge.textContent = 'Cuota al día';
      attPreviewBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
    } else if (match.estado === 'por_vencer') {
      attPreviewBadge.textContent = 'Por Vencer';
      attPreviewBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40';
    } else {
      attPreviewBadge.textContent = '⚠️ Membresía Vencida';
      attPreviewBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40';
    }
  } else {
    attPreviewPlan.textContent = 'Socio no registrado o invitado';
    attPreviewBadge.textContent = 'Externo';
    attPreviewBadge.className = 'px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400';
  }
}

function renderAttendances() {
  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = attendancesState.filter(att => {
    if (currentAttFilter === 'today' && att.fecha !== todayStr) {
      return false;
    }
    if (currentAttSearchQuery) {
      const q = currentAttSearchQuery.toLowerCase();
      const matchName = att.socioNombre.toLowerCase().includes(q);
      const matchAct = (att.actividad || '').toLowerCase().includes(q);
      const matchPlan = (att.socioPlan || '').toLowerCase().includes(q);
      const matchNotes = (att.notas || '').toLowerCase().includes(q);
      return matchName || matchAct || matchPlan || matchNotes;
    }
    return true;
  });

  // A. Tabla Desktop
  if (attendancesTableBody) {
    if (filtered.length === 0) {
      attendancesTableBody.innerHTML = '';
      attendancesEmptyState?.classList.remove('hidden');
    } else {
      attendancesEmptyState?.classList.add('hidden');
      attendancesTableBody.innerHTML = filtered.map(att => {
        const initials = getInitials(att.socioNombre);
        const avatarColor = getAvatarGradient(att.socioNombre);

        let statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Habilitado</span>`;
        if (att.socioEstado === 'vencido') {
          statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Vencido</span>`;
        } else if (att.socioEstado === 'por_vencer') {
          statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Por Vencer</span>`;
        }

        return `
          <tr class="hover:bg-slate-800/40 transition-colors group">
            <td class="py-3.5 px-5">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                  ${initials}
                </div>
                <div>
                  <p class="font-bold text-white text-xs sm:text-sm">${escapeHtml(att.socioNombre)}</p>
                  ${att.notas ? `<p class="text-[11px] text-slate-400 truncate">${escapeHtml(att.notas)}</p>` : ''}
                </div>
              </div>
            </td>
            <td class="py-3.5 px-4 text-xs text-slate-300">
              <p class="font-medium">${escapeHtml(att.socioPlan || 'Pase Libre Full')}</p>
            </td>
            <td class="py-3.5 px-4 text-xs font-mono">
              <span class="text-slate-200 font-semibold">${att.hora}</span>
              <span class="text-slate-500 ml-1">(${formatDate(att.fecha)})</span>
            </td>
            <td class="py-3.5 px-4 text-xs">
              <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                ${escapeHtml(att.actividad || 'Musculación')}
              </span>
            </td>
            <td class="py-3.5 px-4 text-center">
              ${statusBadge}
            </td>
            <td class="py-3.5 px-5 text-right">
              <div class="inline-flex items-center gap-1">
                <button 
                  data-action="edit-att" 
                  data-id="${att.id}"
                  title="Editar asistencia"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button 
                  data-action="delete-att" 
                  data-id="${att.id}"
                  title="Eliminar de Firestore"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // B. Tarjetas Móviles
  if (attendancesCardsContainer) {
    attendancesCardsContainer.innerHTML = filtered.map(att => {
      const initials = getInitials(att.socioNombre);
      const avatarColor = getAvatarGradient(att.socioNombre);

      return `
        <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2.5 text-xs">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center font-bold text-xs shrink-0">
                ${initials}
              </div>
              <div class="min-w-0">
                <h4 class="font-bold text-white text-sm truncate">${escapeHtml(att.socioNombre)}</h4>
                <p class="text-[11px] text-emerald-400 font-medium">${escapeHtml(att.socioPlan || 'Pase Libre Full')}</p>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono font-bold text-slate-200 text-sm">${att.hora}</span>
              <p class="text-[10px] text-slate-500 font-mono">${formatDate(att.fecha)}</p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span class="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-400">
              ${escapeHtml(att.actividad || 'Musculación')}
            </span>
            <div class="flex items-center gap-1">
              <button 
                data-action="edit-att" 
                data-id="${att.id}"
                class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 active:scale-95"
              >
                <i data-lucide="edit-3" class="w-3 h-3"></i> Editar
              </button>
              <button 
                data-action="delete-att" 
                data-id="${att.id}"
                class="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700 active:scale-95"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) window.lucide.createIcons();
  updateAttendanceKPIs();
}

function prepareAttendanceModalForCreate(prefillSocio?: Socio) {
  if (!formAttendance) return;
  formAttendance.reset();

  const idInput = document.getElementById('att-id') as HTMLInputElement | null;
  if (idInput) idInput.value = '';

  if (modalAttendanceTitle) modalAttendanceTitle.textContent = 'Marcar Asistencia en Portería';

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  const fechaInput = document.getElementById('att-fecha') as HTMLInputElement | null;
  const horaInput = document.getElementById('att-hora') as HTMLInputElement | null;
  const socioInput = document.getElementById('att-socio-nombre') as HTMLInputElement | null;

  if (fechaInput) fechaInput.value = dateStr;
  if (horaInput) horaInput.value = timeStr;

  // Datalist de socios
  if (attSociosDatalist) {
    attSociosDatalist.innerHTML = sociosState.map(s => `
      <option value="${escapeHtml(s.nombre)}">${escapeHtml(s.plan)} (${formatPesos(s.precio)})</option>
    `).join('');
  }

  if (prefillSocio) {
    if (socioInput) socioInput.value = prefillSocio.nombre;
    updateAttendanceSocioPreview(prefillSocio.nombre);
  } else {
    updateAttendanceSocioPreview('');
  }
}

function prepareAttendanceModalForEdit(att: Attendance) {
  if (!formAttendance) return;
  if (modalAttendanceTitle) modalAttendanceTitle.textContent = 'Editar Registro de Asistencia';

  const idInput = document.getElementById('att-id') as HTMLInputElement | null;
  if (idInput) idInput.value = att.id;

  const socioInput = document.getElementById('att-socio-nombre') as HTMLInputElement | null;
  if (socioInput) socioInput.value = att.socioNombre;

  const fechaInput = document.getElementById('att-fecha') as HTMLInputElement | null;
  if (fechaInput) fechaInput.value = att.fecha;

  const horaInput = document.getElementById('att-hora') as HTMLInputElement | null;
  if (horaInput) horaInput.value = att.hora;

  const actSelect = document.getElementById('att-actividad') as HTMLSelectElement | null;
  if (actSelect && att.actividad) actSelect.value = att.actividad;

  const notasInput = document.getElementById('att-notas') as HTMLInputElement | null;
  if (notasInput) notasInput.value = att.notas || '';

  // Datalist de socios
  if (attSociosDatalist) {
    attSociosDatalist.innerHTML = sociosState.map(s => `
      <option value="${escapeHtml(s.nombre)}">${escapeHtml(s.plan)} (${formatPesos(s.precio)})</option>
    `).join('');
  }

  updateAttendanceSocioPreview(att.socioNombre);
  openModal(modalAttendance);
}

// Envío del Formulario de Asistencia -> Guarda o Edita en Firestore
formAttendance?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idInput = document.getElementById('att-id') as HTMLInputElement | null;
  const id = idInput?.value;

  const socioNombre = (document.getElementById('att-socio-nombre') as HTMLInputElement)?.value.trim() || '';
  const fecha = (document.getElementById('att-fecha') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
  const hora = (document.getElementById('att-hora') as HTMLInputElement)?.value || '10:00';
  const actividad = (document.getElementById('att-actividad') as HTMLSelectElement)?.value || 'Musculación';
  const notas = (document.getElementById('att-notas') as HTMLInputElement)?.value.trim() || undefined;

  // Match socio para vincular plan y estado actual al check-in
  const matchSocio = sociosState.find(s => s.nombre.toLowerCase() === socioNombre.toLowerCase());
  const socioPlan = matchSocio?.plan || 'Pase Libre Full';
  const socioEstado = matchSocio?.estado || 'activo';
  const socioId = matchSocio?.id || undefined;

  const submitBtn = document.getElementById('btn-save-attendance') as HTMLButtonElement | null;
  const originalText = submitBtn?.innerHTML || 'Confirmar Asistencia';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5"></span> Guardando...';
  }

  try {
    if (id) {
      await updateAttendanceInFirestore(id, {
        socioNombre,
        socioPlan,
        socioEstado,
        fecha,
        hora,
        actividad,
        notas
      });
      showToast('Asistencia modificada', `Se actualizó el ingreso de ${socioNombre}.`);
    } else {
      await addAttendanceToFirestore({
        socioId,
        socioNombre,
        socioPlan,
        socioEstado,
        fecha,
        hora,
        actividad,
        notas
      });
      showToast('Check-in registrado', `Ingreso confirmado para ${socioNombre}.`);
    }
    closeModal(modalAttendance);
  } catch (err) {
    console.error('Error al guardar asistencia:', err);
    showToast('Error', 'No se pudo registrar la asistencia.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
});

// Event Delegation para Acciones de Asistencia (Editar y Eliminar)
async function handleAttendanceActionClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
  if (!target) return;
  const action = target.getAttribute('data-action');
  const id = target.getAttribute('data-id');
  if (!id) return;

  const att = attendancesState.find(a => a.id === id);
  if (!att) return;

  if (action === 'edit-att') {
    prepareAttendanceModalForEdit(att);
  } else if (action === 'delete-att') {
    requestConfirmation({
      title: '¿Eliminar registro de asistencia?',
      itemType: 'Control de Asistencia',
      itemName: att.socioNombre,
      itemDesc: `${att.actividad} • Fecha: ${formatDate(att.fecha)} a las ${att.hora}hs`,
      warning: 'Este registro de ingreso a portería se eliminará permanentemente del historial del gimnasio.',
      confirmBtnText: 'Sí, Eliminar Asistencia',
      onConfirm: async () => {
        await deleteAttendanceFromFirestore(id);
        showToast('Asistencia eliminada', `El registro de ingreso de "${att.socioNombre}" fue eliminado.`);
      }
    });
  }
}

attendancesTableBody?.addEventListener('click', handleAttendanceActionClick);
attendancesCardsContainer?.addEventListener('click', handleAttendanceActionClick);

// Filtros y Búsqueda en Asistencia
btnAttendanceFilterToday?.addEventListener('click', () => {
  currentAttFilter = 'today';
  btnAttendanceFilterToday.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 transition-colors whitespace-nowrap';
  btnAttendanceFilterAll?.setAttribute('class', 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap');
  renderAttendances();
});

btnAttendanceFilterAll?.addEventListener('click', () => {
  currentAttFilter = 'all';
  btnAttendanceFilterAll.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 transition-colors whitespace-nowrap';
  btnAttendanceFilterToday?.setAttribute('class', 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors whitespace-nowrap');
  renderAttendances();
});

searchAttendanceInput?.addEventListener('input', (e) => {
  currentAttSearchQuery = (e.target as HTMLInputElement).value.trim();
  renderAttendances();
});

attSocioNombreInput?.addEventListener('input', () => {
  updateAttendanceSocioPreview(attSocioNombreInput.value);
});

btnOpenNewAttendanceModal?.addEventListener('click', () => {
  prepareAttendanceModalForCreate();
  openModal(modalAttendance);
});
btnCloseAttendanceModal?.addEventListener('click', () => closeModal(modalAttendance));
btnCancelAttendance?.addEventListener('click', () => closeModal(modalAttendance));

// Navegación Sidebar hacia Finanzas y Asistencia con desplazamiento suave
navBtnAnalytics?.addEventListener('click', (e) => {
  e.preventDefault();
  closeSidebar();
  const target = document.getElementById('finanzas-section');
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

navBtnAttendance?.addEventListener('click', (e) => {
  e.preventDefault();
  closeSidebar();
  const target = document.getElementById('asistencia-section');
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ==============================================================================
 * ESTADO DE CONEXIÓN Y SINCRONIZACIÓN EN VIVO
 * ============================================================================== */

function updateConnectionUI(connected: boolean) {
  const badge = document.getElementById('badge-connection-status');
  const sidebarBadge = document.getElementById('sidebar-db-badge');

  if (badge) {
    if (connected) {
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span> Sistema Online • En Vivo';
      badge.className = 'hidden sm:inline-flex items-center text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
    } else {
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span> Sincronizando...';
      badge.className = 'hidden sm:inline-flex items-center text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400';
    }
  }

  if (sidebarBadge) {
    sidebarBadge.className = connected 
      ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' 
      : 'w-2 h-2 rounded-full bg-amber-400';
  }
}

/* ==============================================================================
 * UTILIDADES AUXILIARES
 * ============================================================================== */

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

function getRelativeDateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

/* ==============================================================================
 * GESTIÓN DE AUTENTICACIÓN DEL ADMINISTRADOR (GOOGLE, EMAIL, PASSWORD)
 * ============================================================================== */

let currentAdminUser: any = null;

function switchAuthTab(tab: 'login' | 'register' | 'reset') {
  tabBtnLogin?.classList.remove('border-emerald-400', 'text-emerald-400');
  tabBtnRegister?.classList.remove('border-emerald-400', 'text-emerald-400');
  tabBtnReset?.classList.remove('border-emerald-400', 'text-emerald-400');
  tabBtnLogin?.classList.add('border-transparent', 'text-slate-400');
  tabBtnRegister?.classList.add('border-transparent', 'text-slate-400');
  tabBtnReset?.classList.add('border-transparent', 'text-slate-400');

  formAuthLogin?.classList.add('hidden');
  formAuthRegister?.classList.add('hidden');
  formAuthReset?.classList.add('hidden');

  if (tab === 'login') {
    tabBtnLogin?.classList.add('border-emerald-400', 'text-emerald-400');
    tabBtnLogin?.classList.remove('border-transparent', 'text-slate-400');
    formAuthLogin?.classList.remove('hidden');
    if (modalAuthTitle) modalAuthTitle.textContent = 'Acceso de Administrador';
  } else if (tab === 'register') {
    tabBtnRegister?.classList.add('border-emerald-400', 'text-emerald-400');
    tabBtnRegister?.classList.remove('border-transparent', 'text-slate-400');
    formAuthRegister?.classList.remove('hidden');
    if (modalAuthTitle) modalAuthTitle.textContent = 'Crear Cuenta de Administrador';
  } else if (tab === 'reset') {
    tabBtnReset?.classList.add('border-emerald-400', 'text-emerald-400');
    tabBtnReset?.classList.remove('border-transparent', 'text-slate-400');
    formAuthReset?.classList.remove('hidden');
    if (modalAuthTitle) modalAuthTitle.textContent = 'Recuperar Contraseña';
  }
}

tabBtnLogin?.addEventListener('click', () => switchAuthTab('login'));
tabBtnRegister?.addEventListener('click', () => switchAuthTab('register'));
tabBtnReset?.addEventListener('click', () => switchAuthTab('reset'));

btnGotoResetLink?.addEventListener('click', () => switchAuthTab('reset'));
btnGotoRegisterLink?.addEventListener('click', () => switchAuthTab('register'));
btnGotoLoginLink?.addEventListener('click', () => switchAuthTab('login'));
btnResetBackLink?.addEventListener('click', () => switchAuthTab('login'));

function updateAdminAuthUI(user: any) {
  currentAdminUser = user;

  if (user) {
    const name = user.displayName || user.email?.split('@')[0] || 'Administrador';
    const email = user.email || 'Admin Conectado';

    if (sidebarAdminName) sidebarAdminName.textContent = name;
    if (sidebarAdminEmail) sidebarAdminEmail.textContent = email;

    if (sidebarAdminAvatar) {
      if (user.photoURL) {
        sidebarAdminAvatar.innerHTML = `<img src="${user.photoURL}" alt="${escapeHtml(name)}" class="w-full h-full rounded-lg object-cover ring-2 ring-emerald-500/50" />`;
      } else {
        const initials = name.slice(0, 2).toUpperCase();
        sidebarAdminAvatar.innerHTML = `<span class="font-bold text-emerald-400 text-xs">${initials}</span>`;
      }
    }

    if (sidebarAdminStatusDot) {
      sidebarAdminStatusDot.className = 'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900';
    }

    if (btnSidebarAuth) {
      btnSidebarAuth.setAttribute('title', 'Cerrar Sesión');
      btnSidebarAuth.innerHTML = '<i data-lucide="log-out" class="w-4 h-4 text-rose-400"></i>';
    }

    // Header Perfil
    if (headerAuthContainer) {
      const initials = name.slice(0, 2).toUpperCase();
      headerAuthContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="text-right hidden sm:block">
            <p class="text-xs font-bold text-white truncate max-w-[130px]">${escapeHtml(name)}</p>
            <p class="text-[10px] text-emerald-400 font-medium">Admin Autenticado</p>
          </div>
          <div class="w-9 h-9 rounded-xl overflow-hidden bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-xs shadow-inner">
            ${user.photoURL ? `<img src="${user.photoURL}" class="w-full h-full object-cover" />` : initials}
          </div>
          <button id="btn-header-logout" class="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors" title="Cerrar Sesión">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </div>
      `;
      document.getElementById('btn-header-logout')?.addEventListener('click', handleAdminSignOut);
    }
  } else {
    // Modo invitado / desautenticado
    if (sidebarAdminName) sidebarAdminName.textContent = 'Carlos Mendonça';
    if (sidebarAdminEmail) sidebarAdminEmail.textContent = 'Acceso con Google o Correo';

    if (sidebarAdminAvatar) {
      sidebarAdminAvatar.innerHTML = `<span class="font-bold text-emerald-400 text-xs">TG</span>`;
    }

    if (sidebarAdminStatusDot) {
      sidebarAdminStatusDot.className = 'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900';
    }

    if (btnSidebarAuth) {
      btnSidebarAuth.setAttribute('title', 'Iniciar Sesión');
      btnSidebarAuth.innerHTML = '<i data-lucide="log-in" class="w-4 h-4 text-emerald-400"></i>';
    }

    // Header Botón Ingresar
    if (headerAuthContainer) {
      headerAuthContainer.innerHTML = `
        <button id="btn-header-login" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-bold transition-all shadow-sm">
          <i data-lucide="log-in" class="w-4 h-4 text-emerald-400"></i>
          <span>Acceso Admin</span>
        </button>
      `;
      document.getElementById('btn-header-login')?.addEventListener('click', () => {
        switchAuthTab('login');
        openModal(modalAuth);
      });
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

async function handleAdminSignOut() {
  try {
    await signOutFirebase();
    showToast('Sesión Cerrada', 'Has cerrado la sesión de administrador.');
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    showToast('Error', 'No se pudo cerrar la sesión.', 'error');
  }
}

// 1. Iniciar con Google
btnGoogleLogin?.addEventListener('click', async () => {
  const btnText = document.getElementById('btn-google-login-text');
  const original = btnText?.textContent || 'Continuar con Google';
  if (btnGoogleLogin) (btnGoogleLogin as HTMLButtonElement).disabled = true;
  if (btnText) btnText.textContent = 'Conectando con Google...';

  try {
    const user = await signInWithGoogle();
    if (user) {
      showToast('Bienvenido', `¡Hola, ${user.displayName || 'Admin'}! Sesión iniciada.`);
      closeModal(modalAuth);
    }
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user') {
      console.error('Error en Google Sign-in:', error);
      showToast('Error de Ingreso', error.message || 'No se pudo iniciar sesión con Google.', 'error');
    }
  } finally {
    if (btnGoogleLogin) (btnGoogleLogin as HTMLButtonElement).disabled = false;
    if (btnText) btnText.textContent = original;
  }
});

// 2. Iniciar con Email
formAuthLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = (document.getElementById('login-email') as HTMLInputElement)?.value;
  const pass = (document.getElementById('login-password') as HTMLInputElement)?.value;
  if (!email || !pass) return;

  const submitBtn = document.getElementById('btn-submit-login') as HTMLButtonElement | null;
  const original = submitBtn?.innerHTML || 'Ingresar como Administrador';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5"></span> Verificando...';
  }

  try {
    const user = await signInWithEmail(email, pass);
    if (user) {
      showToast('Acceso Correcto', `¡Bienvenido de nuevo, ${user.displayName || user.email}!`);
      closeModal(modalAuth);
      formAuthLogin.reset();
    }
  } catch (err: any) {
    console.error('Error login email:', err);
    const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
      ? 'Correo o contraseña incorrectos.'
      : (err.message || 'No se pudo iniciar sesión.');
    showToast('Error de Acceso', msg, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  }
});

// 3. Crear Cuenta con Email
formAuthRegister?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = (document.getElementById('register-name') as HTMLInputElement)?.value;
  const email = (document.getElementById('register-email') as HTMLInputElement)?.value;
  const pass = (document.getElementById('register-password') as HTMLInputElement)?.value;
  if (!email || !pass) return;

  const submitBtn = document.getElementById('btn-submit-register') as HTMLButtonElement | null;
  const original = submitBtn?.innerHTML || 'Crear Cuenta de Admin';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5"></span> Creando Cuenta...';
  }

  try {
    const user = await registerWithEmail(email, pass, name);
    if (user) {
      showToast('Cuenta Creada', `¡Bienvenido, ${name || 'Admin'}! Tu cuenta está activa.`);
      closeModal(modalAuth);
      formAuthRegister.reset();
    }
  } catch (err: any) {
    console.error('Error register:', err);
    const msg = err.code === 'auth/email-already-in-use'
      ? 'Este correo ya tiene una cuenta registrada.'
      : err.code === 'auth/weak-password'
      ? 'La contraseña debe tener al menos 6 caracteres.'
      : (err.message || 'No se pudo crear la cuenta.');
    showToast('Error al Registrar', msg, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  }
});

// 4. Recuperar Contraseña
formAuthReset?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = (document.getElementById('reset-email') as HTMLInputElement)?.value;
  if (!email) return;

  const submitBtn = document.getElementById('btn-submit-reset') as HTMLButtonElement | null;
  const original = submitBtn?.innerHTML || 'Enviar Enlace de Recuperación';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin mr-1.5"></span> Enviando...';
  }

  try {
    await resetPassword(email);
    showToast('Correo Enviado', `Se envió el enlace a ${email}. Revisa tu bandeja de entrada.`);
    formAuthReset.reset();
    switchAuthTab('login');
  } catch (err: any) {
    console.error('Error reset pass:', err);
    showToast('Error', err.message || 'No se pudo enviar el correo de recuperación.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  }
});

/* ==============================================================================
 * FITBOT AI - ASISTENTE MULTI-TURNO CON GEMINI
 * ============================================================================== */

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  time: string;
}

let chatHistory: ChatMessage[] = [];
let currentChatModel: 'gemini-3.5-flash' | 'gemini-3.1-flash-lite' = 'gemini-3.5-flash';
let isChatGenerating = false;

// Conmutar modelos de velocidad vs análisis
btnModelLite?.addEventListener('click', () => {
  currentChatModel = 'gemini-3.1-flash-lite';
  btnModelLite.className = 'px-2 py-1 rounded-md bg-teal-500 text-slate-950 font-bold shadow-sm transition-colors';
  btnModelFlash?.setAttribute('class', 'px-2 py-1 rounded-md text-slate-400 hover:text-white transition-colors');
  showToast('Modo Rápido Activado', 'FitBot AI responderá con baja latencia (gemini-3.1-flash-lite).', 'info');
});

btnModelFlash?.addEventListener('click', () => {
  currentChatModel = 'gemini-3.5-flash';
  btnModelFlash.className = 'px-2 py-1 rounded-md bg-teal-500 text-slate-950 font-bold shadow-sm transition-colors';
  btnModelLite?.setAttribute('class', 'px-2 py-1 rounded-md text-slate-400 hover:text-white transition-colors');
  showToast('Modo Análisis Activado', 'FitBot AI responderá con análisis completo (gemini-3.5-flash).', 'info');
});

function formatMarkdownToHtml(text: string): string {
  if (!text) return '';
  let html = escapeHtml(text);

  // Negrita: **texto**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  // Cursiva: *texto*
  html = html.replace(/\*(.*?)\*/g, '<em class="text-teal-300 italic">$1</em>');
  // Listas con viñetas: - o *
  html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li class="ml-4 list-disc text-slate-300 my-0.5">$1</li>');
  // Saltos de línea
  html = html.replace(/\n\n/g, '<div class="h-2"></div>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function buildGymContext(): string {
  const activos = sociosState.filter(s => s.estado === 'activo').length;
  const porVencer = sociosState.filter(s => s.estado === 'por_vencer').length;
  const vencidos = sociosState.filter(s => s.estado === 'vencido').length;
  
  const totalIngresos = transactionsState
    .filter(t => t.tipo === 'ingreso')
    .reduce((sum, t) => sum + t.monto, 0);

  const totalGastos = transactionsState
    .filter(t => t.tipo === 'gasto')
    .reduce((sum, t) => sum + t.monto, 0);

  const planesStr = plansCatalog.map(p => `• ${p.name}: ${formatPesos(p.price)} (${p.durationDays || 30} días)`).join('\n');

  return `
Gimnasio: Titan Fitness Center
Fecha actual: ${new Date().toLocaleDateString('es-ES')}
Cartera de Socios: Total ${sociosState.length} (Activos: ${activos}, Por vencer: ${porVencer}, Vencidos: ${vencidos})
Finanzas: Total Ingresos ${formatPesos(totalIngresos)} | Total Gastos ${formatPesos(totalGastos)} | Balance Neto: ${formatPesos(totalIngresos - totalGastos)}
Catálogo de Planes y Tarifas fijadas por el admin:
${planesStr || 'No hay planes creados aún'}
Asistencias registradas hoy: ${attendancesState.filter(a => a.fecha === new Date().toISOString().split('T')[0]).length}
  `.trim();
}

function renderChatHistory() {
  if (!chatMessagesContainer) return;

  if (chatHistory.length === 0) {
    chatMessagesContainer.innerHTML = `
      <div class="flex items-start gap-2.5 max-w-[90%]">
        <div class="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="p-3.5 rounded-2xl rounded-tl-sm bg-slate-950 border border-slate-800 text-slate-200 space-y-2 leading-relaxed">
          <p class="font-semibold text-white">¡Hola, Admin! 👋 Soy FitBot AI, tu asistente especializado en FitAdmin.</p>
          <p class="text-slate-300">Tengo acceso a tus socios, métricas financieras y planes de membresía. ¿En qué puedo ayudarte hoy?</p>
          
          <div class="pt-2 flex flex-wrap gap-1.5">
            <button type="button" class="chat-prompt-chip px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-teal-500/10 border border-slate-800 hover:border-teal-500/30 text-teal-300 text-[11px] transition-colors text-left">
              💡 ¿Cómo reactivar socios vencidos?
            </button>
            <button type="button" class="chat-prompt-chip px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-teal-500/10 border border-slate-800 hover:border-teal-500/30 text-teal-300 text-[11px] transition-colors text-left">
              💰 Sugerir estrategia de precios de cuotas
            </button>
            <button type="button" class="chat-prompt-chip px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-teal-500/10 border border-slate-800 hover:border-teal-500/30 text-teal-300 text-[11px] transition-colors text-left">
              📱 Redactar mensaje de cobranza por WhatsApp
            </button>
            <button type="button" class="chat-prompt-chip px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-teal-500/10 border border-slate-800 hover:border-teal-500/30 text-teal-300 text-[11px] transition-colors text-left">
              📊 Analizar el balance y flujo de caja
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  chatMessagesContainer.innerHTML = chatHistory.map(msg => {
    const isUser = msg.role === 'user';
    if (isUser) {
      return `
        <div class="flex items-start justify-end gap-2.5">
          <div class="p-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-teal-600 to-emerald-600 text-white max-w-[85%] shadow-md">
            <p class="leading-relaxed whitespace-pre-wrap">${escapeHtml(msg.text)}</p>
            <span class="text-[9px] opacity-75 block text-right mt-1 font-mono">${msg.time}</span>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="flex items-start gap-2.5 max-w-[90%]">
          <div class="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="bot" class="w-4 h-4"></i>
          </div>
          <div class="p-3.5 rounded-2xl rounded-tl-sm bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed shadow-sm">
            <div class="space-y-1">${formatMarkdownToHtml(msg.text)}</div>
            <span class="text-[9px] text-slate-500 block text-left mt-1.5 font-mono">${msg.time} • FitBot AI</span>
          </div>
        </div>
      `;
    }
  }).join('');

  if (window.lucide) window.lucide.createIcons();
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

async function sendChatMessage(userText: string) {
  const text = userText.trim();
  if (!text || isChatGenerating) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  chatHistory.push({
    role: 'user',
    text,
    time: timeStr
  });

  renderChatHistory();

  if (inputChatMessage) inputChatMessage.value = '';
  isChatGenerating = true;

  if (chatTypingIndicator) chatTypingIndicator.classList.remove('hidden');
  if (chatMessagesContainer) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistory.map(m => ({ role: m.role, text: m.text })),
        model: currentChatModel,
        gymContext: buildGymContext()
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Error del servidor HTTP ${res.status}`);
    }

    const data = await res.json();
    const replyText = data.reply || 'No se recibió respuesta del modelo.';

    const replyTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    chatHistory.push({
      role: 'model',
      text: replyText,
      time: replyTime
    });

    renderChatHistory();
  } catch (err: any) {
    console.error('Error al consultar FitBot AI:', err);
    const replyTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    chatHistory.push({
      role: 'model',
      text: `⚠️ Lo siento, ocurrió un error al procesar tu solicitud con Gemini: ${err.message || 'Error de conexión'}.`,
      time: replyTime
    });
    renderChatHistory();
    showToast('Error FitBot AI', 'No se pudo generar respuesta con Gemini.', 'error');
  } finally {
    isChatGenerating = false;
    if (chatTypingIndicator) chatTypingIndicator.classList.add('hidden');
    if (chatMessagesContainer) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    inputChatMessage?.focus();
  }
}

// Envío del Formulario de Chat
formGeminiChat?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (inputChatMessage) {
    sendChatMessage(inputChatMessage.value);
  }
});

// Event Delegation para Chips de Sugerencias
chatMessagesContainer?.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest('.chat-prompt-chip') as HTMLElement | null;
  if (chip) {
    const query = chip.textContent?.trim() || '';
    if (query) {
      sendChatMessage(query);
    }
  }
});

// Limpiar Conversación
btnClearChat?.addEventListener('click', () => {
  chatHistory = [];
  renderChatHistory();
  showToast('Chat Reiniciado', 'Se ha restablecido la conversación con FitBot AI.', 'info');
});

/* ==============================================================================
 * SISTEMA DE NOTIFICACIONES EN TIEMPO REAL (CAMPANITA & PANEL)
 * ============================================================================== */

interface GymNotification {
  id: string;
  type: 'warning' | 'danger' | 'success' | 'info';
  title: string;
  message: string;
  category: string;
  dateStr: string;
  read: boolean;
  filterAction?: 'activo' | 'por_vencer' | 'vencido' | 'all';
  targetSection?: string;
}

let notifActiveTab: 'all' | 'unread' = 'all';

function getReadNotificationIds(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem('gym_read_notifications');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadNotificationIds(ids: Set<string>) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('gym_read_notifications', JSON.stringify(Array.from(ids)));
  } catch {}
}

function getDismissedNotificationIds(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem('gym_dismissed_notifications');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissedNotificationIds(ids: Set<string>) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('gym_dismissed_notifications', JSON.stringify(Array.from(ids)));
  } catch {}
}

function generateNotifications(): GymNotification[] {
  const readIds = getReadNotificationIds();
  const dismissedIds = getDismissedNotificationIds();
  const list: GymNotification[] = [];

  // 1. Socios por vencer (prioridad de alerta)
  const porVencer = sociosState.filter(s => s.estado === 'por_vencer');
  porVencer.forEach(s => {
    const remaining = getDaysRemaining(s.fecha_fin);
    const id = `notif-expiring-${s.id}-${s.fecha_fin}`;
    if (!dismissedIds.has(id)) {
      list.push({
        id,
        type: 'warning',
        title: `Vencimiento Próximo: ${s.nombre}`,
        message: `Plan "${s.plan}" (${formatPesos(s.precio)}) • ${remaining.text}. Haz clic para gestionar renovación.`,
        category: 'Renovación',
        dateStr: s.fecha_fin,
        read: readIds.has(id),
        filterAction: 'por_vencer',
        targetSection: 'socios-section'
      });
    }
  });

  // 2. Socios con cuota vencida
  const vencidos = sociosState.filter(s => s.estado === 'vencido');
  vencidos.slice(0, 6).forEach(s => {
    const id = `notif-expired-${s.id}-${s.fecha_fin}`;
    if (!dismissedIds.has(id)) {
      list.push({
        id,
        type: 'danger',
        title: `Cuota Vencida: ${s.nombre}`,
        message: `El plan "${s.plan}" venció el ${formatDate(s.fecha_fin)}. Requiere cobranza inmediata.`,
        category: 'Cobranza',
        dateStr: s.fecha_fin,
        read: readIds.has(id),
        filterAction: 'vencido',
        targetSection: 'socios-section'
      });
    }
  });

  // 3. Asistencias recientes en portería
  if (attendancesState.length > 0) {
    attendancesState.slice(0, 3).forEach(att => {
      const id = `notif-att-${att.id}`;
      if (!dismissedIds.has(id)) {
        list.push({
          id,
          type: 'info',
          title: `Check-in: ${att.socioNombre}`,
          message: `${att.actividad} registrado a las ${att.hora} hs (${att.socioPlan || 'Membresía'}).`,
          category: 'Portería',
          dateStr: att.fecha,
          read: readIds.has(id),
          targetSection: 'asistencia-section'
        });
      }
    });
  }

  // 4. Últimos movimientos de caja
  if (transactionsState.length > 0) {
    transactionsState.slice(0, 3).forEach(tx => {
      const id = `notif-tx-${tx.id}`;
      if (!dismissedIds.has(id)) {
        const isIngreso = tx.tipo === 'ingreso';
        list.push({
          id,
          type: isIngreso ? 'success' : 'warning',
          title: isIngreso ? `Ingreso Registrado: ${tx.concepto}` : `Gasto Registrado: ${tx.concepto}`,
          message: `${formatPesos(tx.monto)} vía ${tx.metodo} (${tx.categoria}).`,
          category: 'Finanzas',
          dateStr: tx.fecha,
          read: readIds.has(id),
          targetSection: 'finanzas-section'
        });
      }
    });
  }

  // 5. Alerta de bienvenida y sistema online si no hay alertas críticas
  if (list.length === 0) {
    const sysId = 'notif-system-welcome';
    if (!dismissedIds.has(sysId)) {
      list.push({
        id: sysId,
        type: 'info',
        title: 'Sistema Titan Fitness Conectado',
        message: 'Base de datos en tiempo real sincronizada. Control de socios, caja y accesos activo.',
        category: 'Sistema',
        dateStr: new Date().toISOString().split('T')[0],
        read: readIds.has(sysId)
      });
    }
  }

  return list;
}

function renderNotifications() {
  const allNotifs = generateNotifications();
  const unreadCount = allNotifs.filter(n => !n.read).length;
  const readCount = allNotifs.length - unreadCount;

  // Actualizar badge sobre la campana
  if (notificationsBadge) {
    if (unreadCount > 0) {
      notificationsBadge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
      notificationsBadge.classList.remove('hidden');
      notificationsBadge.classList.add('flex');
    } else {
      notificationsBadge.classList.add('hidden');
      notificationsBadge.classList.remove('flex');
    }
  }

  // Actualizar pill en cabecera del dropdown
  if (notificationsUnreadPill) {
    notificationsUnreadPill.textContent = unreadCount === 0 ? '0 nuevas' : unreadCount === 1 ? '1 nueva' : `${unreadCount} nuevas`;
    if (unreadCount === 0) {
      notificationsUnreadPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono';
    } else {
      notificationsUnreadPill.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono';
    }
  }

  // Actualizar contadores en pestañas
  if (notifCountAll) notifCountAll.textContent = allNotifs.length.toString();
  if (notifCountUnread) notifCountUnread.textContent = unreadCount.toString();

  // Actualizar botón "Limpiar leídas"
  if (btnClearReadNotifications) {
    if (readCount > 0) {
      btnClearReadNotifications.classList.remove('hidden');
      btnClearReadNotifications.classList.add('inline-flex');
    } else {
      btnClearReadNotifications.classList.add('hidden');
      btnClearReadNotifications.classList.remove('inline-flex');
    }
  }

  // Actualizar estilo visual de las pestañas
  if (notifFilterAll && notifFilterUnread) {
    if (notifActiveTab === 'all') {
      notifFilterAll.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-white transition-colors';
      notifFilterUnread.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors';
    } else {
      notifFilterAll.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors';
      notifFilterUnread.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors';
    }
  }

  // Filtrar según pestaña activa
  const displayNotifs = notifActiveTab === 'unread' ? allNotifs.filter(n => !n.read) : allNotifs;

  // Renderizar la lista
  if (!notificationsList) return;

  if (displayNotifs.length === 0) {
    notificationsList.innerHTML = `
      <div class="p-8 text-center text-slate-500">
        <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <p class="font-semibold text-slate-300 text-xs">
          ${notifActiveTab === 'unread' ? '¡Estás al día!' : 'Sin notificaciones pendientes'}
        </p>
        <p class="text-[11px] text-slate-500 mt-0.5">
          ${notifActiveTab === 'unread' ? 'No tienes alertas pendientes de lectura.' : 'El sistema no registra alertas en este momento.'}
        </p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  notificationsList.innerHTML = displayNotifs.map(n => {
    const isUnread = !n.read;
    const bgClass = isUnread ? 'bg-slate-800/40 hover:bg-slate-800/70 border-l-2 border-l-amber-400' : 'bg-transparent hover:bg-slate-950/40 opacity-70 hover:opacity-100';
    const borderCol = n.type === 'danger' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                      n.type === 'warning' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                      n.type === 'success' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      'text-teal-400 bg-teal-500/10 border-teal-500/20';

    const iconName = n.type === 'danger' ? 'alert-circle' :
                     n.type === 'warning' ? 'clock' :
                     n.type === 'success' ? 'wallet' : 'user-check';

    return `
      <div 
        class="p-3.5 transition-all flex items-start gap-3 cursor-pointer group ${bgClass}"
        data-notif-id="${n.id}"
        ${n.filterAction ? `data-notif-action="${n.filterAction}"` : ''}
        ${n.targetSection ? `data-notif-target="${n.targetSection}"` : ''}
        title="Haz clic para ver detalles y marcar leída"
      >
        <div class="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border ${borderCol} mt-0.5">
          <i data-lucide="${iconName}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1 mb-0.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">${escapeHtml(n.category)}</span>
            <div class="flex items-center gap-1.5">
              ${isUnread 
                ? '<span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Nueva</span>' 
                : '<span class="text-[10px] text-slate-500 flex items-center gap-0.5"><i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> Leída</span>'
              }
            </div>
          </div>
          <p class="font-bold text-white text-xs leading-snug truncate group-hover:text-emerald-300 transition-colors">${escapeHtml(n.title)}</p>
          <p class="text-slate-300 text-[11px] mt-0.5 leading-relaxed line-clamp-2">${escapeHtml(n.message)}</p>
        </div>
        <div class="shrink-0 flex items-center gap-1 pt-0.5">
          ${isUnread ? `
            <button 
              type="button" 
              data-mark-single-read="${n.id}" 
              title="Marcar como leída" 
              class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-slate-700 hover:border-emerald-500/30 transition-all active:scale-90"
            >
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
            </button>
          ` : `
            <button 
              type="button" 
              data-dismiss-single="${n.id}" 
              title="Eliminar de la lista" 
              class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all active:scale-90"
            >
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// Pestañas de Notificaciones
notifFilterAll?.addEventListener('click', (e) => {
  e.stopPropagation();
  notifActiveTab = 'all';
  renderNotifications();
});

notifFilterUnread?.addEventListener('click', (e) => {
  e.stopPropagation();
  notifActiveTab = 'unread';
  renderNotifications();
});

// Limpiar notificaciones leídas
btnClearReadNotifications?.addEventListener('click', (e) => {
  e.stopPropagation();
  const allNotifs = generateNotifications();
  const readNotifs = allNotifs.filter(n => n.read);
  const dismissedIds = getDismissedNotificationIds();
  readNotifs.forEach(n => dismissedIds.add(n.id));
  saveDismissedNotificationIds(dismissedIds);
  renderNotifications();
  showToast('Historial limpio', 'Se removieron las notificaciones leídas.', 'info');
});

// Abrir/Cerrar Dropdown de Notificaciones
function toggleNotificationsDropdown() {
  if (!notificationsDropdown) return;
  const isHidden = notificationsDropdown.classList.contains('hidden');
  if (isHidden) {
    renderNotifications();
    notificationsDropdown.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  } else {
    notificationsDropdown.classList.add('hidden');
  }
}

btnNotifications?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleNotificationsDropdown();
});

btnCloseNotifications?.addEventListener('click', () => {
  notificationsDropdown?.classList.add('hidden');
});

// Cerrar al hacer clic fuera del menú de notificaciones
document.addEventListener('click', (e) => {
  if (notificationsDropdown && !notificationsDropdown.classList.contains('hidden')) {
    const target = e.target as HTMLElement;
    if (!notificationsDropdown.contains(target) && !btnNotifications?.contains(target)) {
      notificationsDropdown.classList.add('hidden');
    }
  }
});

// Marcar todas como leídas
btnMarkAllRead?.addEventListener('click', (e) => {
  e.stopPropagation();
  const notifs = generateNotifications();
  const readIds = getReadNotificationIds();
  notifs.forEach(n => readIds.add(n.id));
  saveReadNotificationIds(readIds);
  renderNotifications();
  showToast('Notificaciones leídas', 'Todas las notificaciones fueron marcadas como leídas.', 'success');
});

// Event Delegation para marcar individualmente, descartar o hacer clic en la fila de notificación
notificationsList?.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement);
  
  // 1. Botón de marcar como leída individual
  const markBtn = target.closest('button[data-mark-single-read]') as HTMLButtonElement | null;
  if (markBtn) {
    e.stopPropagation();
    const id = markBtn.getAttribute('data-mark-single-read');
    if (id) {
      const readIds = getReadNotificationIds();
      readIds.add(id);
      saveReadNotificationIds(readIds);
      renderNotifications();
      showToast('Notificación leída', 'La alerta fue marcada como leída.', 'info');
    }
    return;
  }

  // 2. Botón de descartar individual
  const dismissBtn = target.closest('button[data-dismiss-single]') as HTMLButtonElement | null;
  if (dismissBtn) {
    e.stopPropagation();
    const id = dismissBtn.getAttribute('data-dismiss-single');
    if (id) {
      const dismissedIds = getDismissedNotificationIds();
      dismissedIds.add(id);
      saveDismissedNotificationIds(dismissedIds);
      renderNotifications();
    }
    return;
  }

  // 3. Clic en la fila de la notificación: marcar como leída y navegar a la sección correspondiente
  const row = target.closest('[data-notif-id]') as HTMLElement | null;
  if (row) {
    const id = row.getAttribute('data-notif-id');
    const action = row.getAttribute('data-notif-action') as EstadoSocio | null;
    const targetSection = row.getAttribute('data-notif-target');
    
    if (id) {
      const readIds = getReadNotificationIds();
      readIds.add(id);
      saveReadNotificationIds(readIds);
      renderNotifications();
    }

    if (action) {
      notificationsDropdown?.classList.add('hidden');
      applyFilter(action, true);
      const section = document.getElementById('socios-section');
      section?.scrollIntoView({ behavior: 'smooth' });
    } else if (targetSection) {
      notificationsDropdown?.classList.add('hidden');
      const elem = document.getElementById(targetSection);
      elem?.scrollIntoView({ behavior: 'smooth' });
    }
  }
});

/* ==============================================================================
 * INICIALIZACIÓN Y SUSCRIPCIÓN EN TIEMPO REAL
 * ============================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Fecha actual en la cabecera
  const dateDisplay = document.getElementById('current-date-display');
  if (dateDisplay) {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
    dateDisplay.textContent = `Actualizado: ${now.toLocaleDateString('es-ES', options)}`;
  }

  // 1. Conexión a Firebase
  onFirebaseConnectionChange((connected) => {
    isFirebaseConnected = connected;
    updateConnectionUI(connected);
  });

  // 2. Suscripción en tiempo real a los planes de membresía definidos por el admin
  subscribeToPlans((plans) => {
    plansCatalog = plans;
    renderPlansUI();
  });

  // 3. Suscripción en tiempo real a la cartera de socios en Firestore
  subscribeToSocios((socios) => {
    sociosState = socios;
    renderSocios(sociosState);
    renderNotifications();
  });

  // 4. Suscripción en tiempo real a Finanzas (Ingresos y Gastos de Caja)
  subscribeToTransactions((txs) => {
    transactionsState = txs;
    renderTransactions();
    renderNotifications();
  });

  // 5. Suscripción en tiempo real a Asistencias (Check-in en Portería)
  subscribeToAttendances((atts) => {
    attendancesState = atts;
    renderAttendances();
    renderNotifications();
  });

  // 6. Suscripción en tiempo real al estado de autenticación del administrador
  subscribeToAuth((user) => {
    updateAdminAuthUI(user);
  });

  // 7. Inicializar notificaciones
  renderNotifications();

  // 8. Inicializar chat de FitBot AI
  renderChatHistory();

  // 9. Inicializar iconos
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
