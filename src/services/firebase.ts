import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer,
  query,
  orderBy,
  where,
  Unsubscribe
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Configuración con soporte dual: variables de entorno (Netlify / GitHub Actions) o archivo local
const resolvedFirebaseConfig = {
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
};

const resolvedDatabaseId = (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

// Inicialización de la App de Firebase
const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

// Conexión con Firestore usando la base de datos configurada
export const db = getFirestore(app, resolvedDatabaseId);
export const auth = getAuth(app);

// Estado de conexión a Firebase
let isFirebaseConnected = false;
let connectionListeners: Array<(connected: boolean) => void> = [];

export function onFirebaseConnectionChange(cb: (connected: boolean) => void) {
  connectionListeners.push(cb);
  cb(isFirebaseConnected);
}

function notifyConnectionState(connected: boolean) {
  isFirebaseConnected = connected;
  connectionListeners.forEach(cb => cb(connected));
}

// Validación de conexión según Skill de Firebase
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    notifyConnectionState(true);
    console.log('🔥 [Firebase] Conexión establecida con éxito a Firestore:', firebaseConfig.projectId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('⚠️ [Firebase] El cliente está en modo sin conexión.');
      notifyConnectionState(false);
    } else {
      notifyConnectionState(true);
    }
  }
}
testFirestoreConnection();

/* ==============================================================================
 * MANEJO DE ERRORES FIRESTORE (Conforme a Firebase Skill)
 * ============================================================================== */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('🔥 Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/* ==============================================================================
 * MODELOS DE DATOS: PLANES Y SOCIOS
 * ============================================================================== */
export interface Plan {
  id: string;
  name: string;
  price: number;
  description?: string;
  durationDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type EstadoSocio = 'activo' | 'por_vencer' | 'vencido';

export interface Socio {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  plan: string;
  precio: number;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string;    // YYYY-MM-DD
  estado: EstadoSocio;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TipoTransaccion = 'ingreso' | 'gasto';

export interface Transaction {
  id: string;
  tipo: TipoTransaccion;
  concepto: string;
  categoria: string;
  monto: number;
  fecha: string;
  metodo: string;
  socioId?: string;
  socioNombre?: string;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attendance {
  id: string;
  socioId?: string;
  socioNombre: string;
  socioPlan?: string;
  socioEstado?: string;
  fecha: string;
  hora: string;
  actividad?: string;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ==============================================================================
 * CATÁLOGO DE PLANES POR DEFECTO PARA SEEDING (EN PESOS $)
 * ============================================================================== */
export function formatPesos(amount: number): string {
  return '$ ' + Number(amount || 0).toLocaleString('es-AR');
}

export const DEFAULT_PLANS: Omit<Plan, 'id'>[] = [
  {
    name: 'Pase Libre Full',
    price: 45000,
    description: 'Acceso total e ilimitado a máquinas, cardio y todas las clases grupales',
    durationDays: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Musculación Clásica',
    price: 35000,
    description: 'Acceso ilimitado a sector de máquinas, peso libre y rutinas estándar',
    durationDays: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'CrossFit & Funcional',
    price: 50000,
    description: 'WODs diarios con coach certificado, zona de barras y equipamiento olímpico',
    durationDays: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Plan VIP Anual',
    price: 380000,
    description: 'Membresía anual con descuento especial, casillero privado y toalla incluida',
    durationDays: 365,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Estudiante / Juvenil',
    price: 28000,
    description: 'Tarifa preferencial para alumnos regulares presentando credencial vigente',
    durationDays: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Pase 10 Clases',
    price: 32000,
    description: 'Bono flexible para utilizar en un lapso máximo de 60 días',
    durationDays: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/* ==============================================================================
 * DATOS INICIALES DE SOCIOS PARA SEEDING (EN PESOS $)
 * ============================================================================== */
function getRelativeDateStr(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
}

export const DEFAULT_SOCIOS: Omit<Socio, 'id'>[] = [
  {
    nombre: 'Valentina Rossi',
    email: 'valentina.rossi@email.com',
    telefono: '+54 9 11 4892-1102',
    plan: 'Pase Libre Full',
    precio: 45000,
    fecha_inicio: getRelativeDateStr(-25),
    fecha_fin: getRelativeDateStr(5),
    estado: 'por_vencer',
    notas: 'Socia desde hace 1 año. Solicitar renovación de rutina.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    nombre: 'Mateo Fernández',
    email: 'mateo.f@gymmail.com',
    telefono: '+54 9 11 6321-9988',
    plan: 'CrossFit & Funcional',
    precio: 50000,
    fecha_inicio: getRelativeDateStr(-10),
    fecha_fin: getRelativeDateStr(20),
    estado: 'activo',
    notas: 'Entrena por la mañana en turno 08:00 hs.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    nombre: 'Lucía Benítez',
    email: 'lucia.benitez@empresa.com',
    telefono: '+54 9 11 5543-2211',
    plan: 'Musculación Clásica',
    precio: 35000,
    fecha_inicio: getRelativeDateStr(-35),
    fecha_fin: getRelativeDateStr(-5),
    estado: 'vencido',
    notas: 'Membresía vencida hace 5 días. Enviar recordatorio WhatsApp.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    nombre: 'Agustín Gómez',
    email: 'agustin.g@techcorp.io',
    telefono: '+54 9 11 7711-4320',
    plan: 'Plan VIP Anual',
    precio: 380000,
    fecha_inicio: getRelativeDateStr(-60),
    fecha_fin: getRelativeDateStr(305),
    estado: 'activo',
    notas: 'Pago anual completado. Casillero #14 asignado.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    nombre: 'Sofía Navarro',
    email: 'sofia.navarro@universidad.edu',
    telefono: '+54 9 11 3209-8877',
    plan: 'Estudiante / Juvenil',
    precio: 28000,
    fecha_inicio: getRelativeDateStr(-28),
    fecha_fin: getRelativeDateStr(2),
    estado: 'por_vencer',
    notas: 'Presentó certificado de estudiante regular.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    nombre: 'Javier Morales',
    email: 'javier.morales@fitpro.com',
    telefono: '+54 9 11 9845-6612',
    plan: 'Pase Libre Full',
    precio: 45000,
    fecha_inicio: getRelativeDateStr(-40),
    fecha_fin: getRelativeDateStr(-10),
    estado: 'vencido',
    notas: 'Viaje laboral. Avisó que reanuda a fin de mes.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    nombre: 'Camila Herrera',
    email: 'camila.herrera@estudio.com',
    telefono: '+54 9 11 4123-5566',
    plan: 'Pase 10 Clases',
    precio: 32000,
    fecha_inicio: getRelativeDateStr(-15),
    fecha_fin: getRelativeDateStr(45),
    estado: 'activo',
    notas: 'Ha utilizado 4 de 10 clases.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/* ==============================================================================
 * SERVICIOS CRUD DE FIRESTORE: PLANES DE MEMBRESÍA
 * ============================================================================== */

// Registro de planes eliminados para evitar que vuelvan a aparecer
function getDeletedPlanNames(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem('gym_deleted_plan_names');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addDeletedPlanName(name: string) {
  try {
    if (typeof window === 'undefined') return;
    const set = getDeletedPlanNames();
    set.add(name.trim().toLowerCase());
    localStorage.setItem('gym_deleted_plan_names', JSON.stringify(Array.from(set)));
  } catch {}
}

function removeDeletedPlanName(name: string) {
  try {
    if (typeof window === 'undefined') return;
    const set = getDeletedPlanNames();
    set.delete(name.trim().toLowerCase());
    localStorage.setItem('gym_deleted_plan_names', JSON.stringify(Array.from(set)));
  } catch {}
}

function getDeletedPlanIds(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem('gym_deleted_plan_ids');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addDeletedPlanId(id: string) {
  try {
    if (typeof window === 'undefined') return;
    const set = getDeletedPlanIds();
    set.add(id);
    localStorage.setItem('gym_deleted_plan_ids', JSON.stringify(Array.from(set)));
  } catch {}
}

let hasSeededPlans = typeof window !== 'undefined' && localStorage.getItem('gym_has_seeded_plans') === 'true';

/**
 * Escucha cambios en tiempo real de los planes definidos por el admin
 */
export function subscribeToPlans(callback: (plans: Plan[]) => void): Unsubscribe {
  const plansCol = collection(db, 'plans');
  return onSnapshot(
    plansCol,
    async (snapshot) => {
      notifyConnectionState(true);
      const deletedNames = getDeletedPlanNames();
      const deletedIds = getDeletedPlanIds();

      if (snapshot.empty) {
        if (!hasSeededPlans) {
          hasSeededPlans = true;
          if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_plans', 'true');
          
          // Sembrar solo aquellos que no hayan sido eliminados previamente
          const toSeed = DEFAULT_PLANS.filter(p => !deletedNames.has(p.name.trim().toLowerCase()));
          try {
            for (const plan of toSeed) {
              await addDoc(plansCol, {
                ...plan,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          } catch (e) {
            console.warn('No se pudieron crear planes iniciales:', e);
          }
          return;
        } else {
          // Si el usuario eliminó todos los planes, NO volver a sembrarlos jamás
          callback([]);
          return;
        }
      }

      hasSeededPlans = true;
      if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_plans', 'true');

      let plans: Plan[] = snapshot.docs
        .map(docSnap => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Plan, 'id'>)
        }))
        // Filtro permanente: excluir planes eliminados tanto por ID como por nombre
        .filter(p => !deletedNames.has((p.name || '').trim().toLowerCase()) && !deletedIds.has(p.id));

      // Ordenar por precio ascendente
      plans.sort((a, b) => (a.price || 0) - (b.price || 0));
      callback(plans);
    },
    (error) => {
      console.warn('⚠️ [Firebase] onSnapshot plans notice:', error);
      const deletedNames = getDeletedPlanNames();
      const deletedIds = getDeletedPlanIds();
      const filtered = DEFAULT_PLANS
        .filter(p => !deletedNames.has(p.name.trim().toLowerCase()))
        .map((p, idx) => ({ ...p, id: `plan-${idx + 1}` }))
        .filter(p => !deletedIds.has(p.id));
      callback(filtered);
      handleFirestoreError(error, OperationType.GET, 'plans');
    }
  );
}

/**
 * Agrega un nuevo plan de membresía fijado por el admin en Firestore
 */
export async function addPlanToFirestore(planData: Omit<Plan, 'id'>): Promise<string> {
  const plansCol = collection(db, 'plans');
  const cleanName = planData.name.trim();
  // Al crear o reactivar un plan con este nombre, lo quitamos de la lista negra
  removeDeletedPlanName(cleanName);

  try {
    const docRef = await addDoc(plansCol, {
      name: cleanName,
      price: Number(planData.price) || 0,
      description: planData.description?.trim() || '',
      durationDays: Number(planData.durationDays) || 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'plans');
    return '';
  }
}

/**
 * Actualiza un plan de membresía existente fijado por el admin
 */
export async function updatePlanInFirestore(planId: string, planData: Partial<Plan>): Promise<void> {
  const docRef = doc(db, 'plans', planId);
  if (planData.name) {
    removeDeletedPlanName(planData.name.trim());
  }

  try {
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (planData.name !== undefined) updatePayload.name = planData.name.trim();
    if (planData.price !== undefined) updatePayload.price = Number(planData.price) || 0;
    if (planData.description !== undefined) updatePayload.description = planData.description.trim();
    if (planData.durationDays !== undefined) updatePayload.durationDays = Number(planData.durationDays) || 30;

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `plans/${planId}`);
  }
}

/**
 * Elimina un plan de membresía de Firestore y garantiza que no vuelva a aparecer
 */
export async function deletePlanFromFirestore(planId: string, planName?: string): Promise<void> {
  addDeletedPlanId(planId);
  if (planName) {
    addDeletedPlanName(planName);
  }

  try {
    // 1. Eliminar documento directo si tiene un ID válido de Firestore
    if (!planId.startsWith('plan-')) {
      const docRef = doc(db, 'plans', planId);
      await deleteDoc(docRef);
    }

    // 2. Si se proporcionó el nombre o tiene id ficticio, buscar y borrar todos los documentos con ese nombre en Firestore
    if (planName) {
      const plansCol = collection(db, 'plans');
      const q = query(plansCol, where('name', '==', planName));
      const querySnap = await getDocs(q);
      for (const d of querySnap.docs) {
        await deleteDoc(d.ref);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `plans/${planId}`);
  }
}

/* ==============================================================================
 * SERVICIOS CRUD DE FIRESTORE: SOCIOS
 * ============================================================================== */

let hasSeededSocios = typeof window !== 'undefined' && localStorage.getItem('gym_has_seeded_socios') === 'true';

/**
 * Escucha cambios en tiempo real de la cartera de socios en Firestore
 */
export function subscribeToSocios(callback: (socios: Socio[]) => void): Unsubscribe {
  const sociosCol = collection(db, 'socios');
  return onSnapshot(
    sociosCol,
    async (snapshot) => {
      notifyConnectionState(true);
      if (snapshot.empty) {
        if (!hasSeededSocios) {
          hasSeededSocios = true;
          if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_socios', 'true');
          console.log('ℹ️ [Firebase] Sembrando socios iniciales en Firestore...');
          callback(DEFAULT_SOCIOS.map((s, idx) => ({ ...s, id: `socio-${idx + 1}` })));
          try {
            for (const socio of DEFAULT_SOCIOS) {
              await addDoc(sociosCol, socio);
            }
          } catch (e) {
            console.warn('No se pudieron sembrar socios iniciales:', e);
          }
          return;
        } else {
          // El usuario eliminó todos los socios de forma intencional
          callback([]);
          return;
        }
      }

      hasSeededSocios = true;
      if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_socios', 'true');

      const socios: Socio[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          nombre: data.nombre || '',
          email: data.email || '',
          telefono: data.telefono || '',
          plan: data.plan || '',
          precio: Number(data.precio) || 0,
          fecha_inicio: data.fecha_inicio || '',
          fecha_fin: data.fecha_fin || '',
          estado: (data.estado as EstadoSocio) || 'activo',
          notas: data.notas || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        };
      });

      // Ordenar por fecha de vencimiento más próxima primero
      socios.sort((a, b) => new Date(a.fecha_fin).getTime() - new Date(b.fecha_fin).getTime());
      callback(socios);
    },
    (error) => {
      console.warn('⚠️ [Firebase] onSnapshot socios notice:', error);
      callback(DEFAULT_SOCIOS.map((s, idx) => ({ ...s, id: `socio-${idx + 1}` })));
      handleFirestoreError(error, OperationType.GET, 'socios');
    }
  );
}

/**
 * Agrega un nuevo socio a Firestore
 */
export async function addSocioToFirestore(socio: Omit<Socio, 'id'>): Promise<string> {
  const sociosCol = collection(db, 'socios');
  try {
    const docRef = await addDoc(sociosCol, {
      nombre: socio.nombre.trim(),
      email: socio.email.trim(),
      telefono: socio.telefono.trim(),
      plan: socio.plan.trim(),
      precio: Number(socio.precio) || 0,
      fecha_inicio: socio.fecha_inicio,
      fecha_fin: socio.fecha_fin,
      estado: socio.estado,
      notas: socio.notas?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'socios');
    return '';
  }
}

/**
 * Actualiza un socio en Firestore
 */
export async function updateSocioInFirestore(socioId: string, socioData: Partial<Socio>): Promise<void> {
  const docRef = doc(db, 'socios', socioId);
  try {
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (socioData.nombre !== undefined) updatePayload.nombre = socioData.nombre.trim();
    if (socioData.email !== undefined) updatePayload.email = socioData.email.trim();
    if (socioData.telefono !== undefined) updatePayload.telefono = socioData.telefono.trim();
    if (socioData.plan !== undefined) updatePayload.plan = socioData.plan.trim();
    if (socioData.precio !== undefined) updatePayload.precio = Number(socioData.precio) || 0;
    if (socioData.fecha_inicio !== undefined) updatePayload.fecha_inicio = socioData.fecha_inicio;
    if (socioData.fecha_fin !== undefined) updatePayload.fecha_fin = socioData.fecha_fin;
    if (socioData.estado !== undefined) updatePayload.estado = socioData.estado;
    if (socioData.notas !== undefined) updatePayload.notas = socioData.notas.trim();

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `socios/${socioId}`);
  }
}

/**
 * Elimina un socio de Firestore
 */
export async function deleteSocioFromFirestore(socioId: string): Promise<void> {
  const docRef = doc(db, 'socios', socioId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `socios/${socioId}`);
  }
}

/* ==============================================================================
 * DATOS INICIALES Y SERVICIOS CRUD: FINANZAS (TRANSACCIONES)
 * ============================================================================== */

export const DEFAULT_TRANSACTIONS: Omit<Transaction, 'id'>[] = [
  {
    tipo: 'ingreso',
    concepto: 'Cuota Mensual - Valentina Rossi',
    categoria: 'Cuotas Membresía',
    monto: 45000,
    fecha: getRelativeDateStr(-25),
    metodo: 'Transferencia',
    socioNombre: 'Valentina Rossi',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    tipo: 'ingreso',
    concepto: 'Cuota CrossFit - Mateo Fernández',
    categoria: 'Cuotas Membresía',
    monto: 50000,
    fecha: getRelativeDateStr(-10),
    metodo: 'MercadoPago',
    socioNombre: 'Mateo Fernández',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    tipo: 'ingreso',
    concepto: 'Venta Proteína Whey 2kg + Shaker',
    categoria: 'Suplementos & Tienda',
    monto: 68000,
    fecha: getRelativeDateStr(-3),
    metodo: 'Efectivo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    tipo: 'gasto',
    concepto: 'Mantenimiento Preventivo Cintas de Correr',
    categoria: 'Mantenimiento',
    monto: 85000,
    fecha: getRelativeDateStr(-8),
    metodo: 'Transferencia',
    notas: 'Cambio de bandas y lubricación de rodamientos',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    tipo: 'gasto',
    concepto: 'Factura Luz & Climatización Sede',
    categoria: 'Servicios',
    monto: 145000,
    fecha: getRelativeDateStr(-5),
    metodo: 'Débito Automático',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    tipo: 'ingreso',
    concepto: 'Plan VIP Anual - Agustín Gómez',
    categoria: 'Cuotas Membresía',
    monto: 380000,
    fecha: getRelativeDateStr(-1),
    metodo: 'Transferencia',
    socioNombre: 'Agustín Gómez',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let hasSeededTransactions = typeof window !== 'undefined' && localStorage.getItem('gym_has_seeded_txs') === 'true';

export function subscribeToTransactions(callback: (txs: Transaction[]) => void): Unsubscribe {
  const col = collection(db, 'transactions');
  return onSnapshot(
    col,
    async (snapshot) => {
      if (snapshot.empty) {
        if (!hasSeededTransactions) {
          hasSeededTransactions = true;
          try {
            if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_txs', 'true');
            callback(DEFAULT_TRANSACTIONS.map((t, i) => ({ ...t, id: `tx-${i + 1}` })));
            for (const item of DEFAULT_TRANSACTIONS) {
              await addDoc(col, item);
            }
          } catch (e) {
            console.warn('No se pudieron sembrar transacciones iniciales:', e);
          }
          return;
        } else {
          // Si el usuario eliminó todos los movimientos de forma intencional
          callback([]);
          return;
        }
      }

      hasSeededTransactions = true;
      if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_txs', 'true');

      const txs: Transaction[] = snapshot.docs.map(snap => ({
        id: snap.id,
        ...(snap.data() as Omit<Transaction, 'id'>)
      }));

      // Ordenar por fecha descendente
      txs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      callback(txs);
    },
    (error) => {
      console.warn('⚠️ [Firebase] onSnapshot transactions notice:', error);
      callback(DEFAULT_TRANSACTIONS.map((t, i) => ({ ...t, id: `tx-${i + 1}` })));
      handleFirestoreError(error, OperationType.GET, 'transactions');
    }
  );
}

export async function addTransactionToFirestore(data: Omit<Transaction, 'id'>): Promise<string> {
  const col = collection(db, 'transactions');
  try {
    const docRef = await addDoc(col, {
      ...data,
      concepto: data.concepto.trim(),
      categoria: data.categoria.trim(),
      monto: Number(data.monto) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
    return '';
  }
}

export async function updateTransactionInFirestore(id: string, data: Partial<Transaction>): Promise<void> {
  const docRef = doc(db, 'transactions', id);
  try {
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (data.tipo !== undefined) updatePayload.tipo = data.tipo;
    if (data.concepto !== undefined) updatePayload.concepto = data.concepto.trim();
    if (data.categoria !== undefined) updatePayload.categoria = data.categoria.trim();
    if (data.monto !== undefined) updatePayload.monto = Number(data.monto) || 0;
    if (data.fecha !== undefined) updatePayload.fecha = data.fecha;
    if (data.metodo !== undefined) updatePayload.metodo = data.metodo.trim();
    if (data.socioNombre !== undefined) updatePayload.socioNombre = data.socioNombre.trim();
    if (data.notas !== undefined) updatePayload.notas = data.notas.trim();

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
  }
}

export async function deleteTransactionFromFirestore(id: string): Promise<void> {
  const docRef = doc(db, 'transactions', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
  }
}

/* ==============================================================================
 * DATOS INICIALES Y SERVICIOS CRUD: ASISTENCIAS (CHECK-INS)
 * ============================================================================== */

export const DEFAULT_ATTENDANCES: Omit<Attendance, 'id'>[] = [
  {
    socioNombre: 'Mateo Fernández',
    socioPlan: 'CrossFit & Funcional',
    socioEstado: 'activo',
    fecha: getRelativeDateStr(0),
    hora: '08:15',
    actividad: 'CrossFit',
    notas: 'Turno WOD mañana',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    socioNombre: 'Valentina Rossi',
    socioPlan: 'Pase Libre Full',
    socioEstado: 'por_vencer',
    fecha: getRelativeDateStr(0),
    hora: '09:30',
    actividad: 'Musculación',
    notas: 'Rutina piernas',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    socioNombre: 'Agustín Gómez',
    socioPlan: 'Plan VIP Anual',
    socioEstado: 'activo',
    fecha: getRelativeDateStr(0),
    hora: '10:45',
    actividad: 'Cardio & Pesas',
    notas: 'Entrenamiento funcional',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    socioNombre: 'Camila Herrera',
    socioPlan: 'Pase 10 Clases',
    socioEstado: 'activo',
    fecha: getRelativeDateStr(-1),
    hora: '18:20',
    actividad: 'Spinning',
    notas: 'Clase 4 de 10',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    socioNombre: 'Lucía Benítez',
    socioPlan: 'Musculación Clásica',
    socioEstado: 'vencido',
    fecha: getRelativeDateStr(-2),
    hora: '19:00',
    actividad: 'Musculación',
    notas: 'Aviso de renovación de cuota dado en recepción',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let hasSeededAttendances = typeof window !== 'undefined' && localStorage.getItem('gym_has_seeded_attendances') === 'true';

export function subscribeToAttendances(callback: (atts: Attendance[]) => void): Unsubscribe {
  const col = collection(db, 'attendances');
  return onSnapshot(
    col,
    async (snapshot) => {
      if (snapshot.empty) {
        if (!hasSeededAttendances) {
          hasSeededAttendances = true;
          if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_attendances', 'true');
          callback(DEFAULT_ATTENDANCES.map((a, i) => ({ ...a, id: `att-${i + 1}` })));
          try {
            for (const item of DEFAULT_ATTENDANCES) {
              await addDoc(col, item);
            }
          } catch (e) {
            console.warn('No se pudieron sembrar asistencias iniciales:', e);
          }
          return;
        } else {
          // El usuario eliminó todas las asistencias
          callback([]);
          return;
        }
      }

      hasSeededAttendances = true;
      if (typeof window !== 'undefined') localStorage.setItem('gym_has_seeded_attendances', 'true');

      const atts: Attendance[] = snapshot.docs.map(snap => ({
        id: snap.id,
        ...(snap.data() as Omit<Attendance, 'id'>)
      }));

      // Ordenar por fecha y hora descendente
      atts.sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`));
      callback(atts);
    },
    (error) => {
      console.warn('⚠️ [Firebase] onSnapshot attendances notice:', error);
      callback(DEFAULT_ATTENDANCES.map((a, i) => ({ ...a, id: `att-${i + 1}` })));
      handleFirestoreError(error, OperationType.GET, 'attendances');
    }
  );
}

export async function addAttendanceToFirestore(data: Omit<Attendance, 'id'>): Promise<string> {
  const col = collection(db, 'attendances');
  try {
    const docRef = await addDoc(col, {
      ...data,
      socioNombre: data.socioNombre.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'attendances');
    return '';
  }
}

export async function updateAttendanceInFirestore(id: string, data: Partial<Attendance>): Promise<void> {
  const docRef = doc(db, 'attendances', id);
  try {
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (data.socioNombre !== undefined) updatePayload.socioNombre = data.socioNombre.trim();
    if (data.socioPlan !== undefined) updatePayload.socioPlan = data.socioPlan.trim();
    if (data.socioEstado !== undefined) updatePayload.socioEstado = data.socioEstado;
    if (data.fecha !== undefined) updatePayload.fecha = data.fecha;
    if (data.hora !== undefined) updatePayload.hora = data.hora;
    if (data.actividad !== undefined) updatePayload.actividad = data.actividad.trim();
    if (data.notas !== undefined) updatePayload.notas = data.notas.trim();

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attendances/${id}`);
  }
}

export async function deleteAttendanceFromFirestore(id: string): Promise<void> {
  const docRef = doc(db, 'attendances', id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendances/${id}`);
  }
}

/* ==============================================================================
 * AUTENTICACIÓN FIREBASE AUTH (GOOGLE, EMAIL/PASSWORD, RESET PASSWORD)
 * ============================================================================== */

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  }
}

export async function signInWithEmail(email: string, pass: string): Promise<User | null> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return result.user;
  } catch (error) {
    console.error('Error al iniciar sesión con email:', error);
    throw error;
  }
}

export async function registerWithEmail(email: string, pass: string, displayName?: string): Promise<User | null> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName: displayName.trim() });
    }
    return result.user;
  } catch (error) {
    console.error('Error al registrar usuario admin:', error);
    throw error;
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    console.error('Error al enviar correo de recuperación:', error);
    throw error;
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

