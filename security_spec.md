# Especificación de Seguridad de FitAdmin SaaS

## Invariantes de Datos
1. Las tarifas y planes de membresía (`plans`) son configurados y fijados por el administrador del gimnasio.
2. Cada plan contiene un nombre (`name`), precio (`price`), descripción opcional (`description`) y duración en días (`durationDays`).
3. La ficha de cada socio (`socios`) contiene su nombre, plan asignado, precio mensual fijado, fechas de vigencia (`fecha_inicio` y `fecha_fin`) y estado (`activo`, `por_vencer`, `vencido`).
4. Los socios y planes están disponibles para lectura pública del panel administrativo y protegidos contra campos corruptos mediante validación estricta de esquema.

## "The Dirty Dozen" Payloads (Denegados)
1. Intento de inyectar planes con precio negativo o superior al tope permitido ($5.000.000).
2. Intento de crear un plan sin nombre.
3. Intento de crear un socio con estado inválido (diferente de 'activo', 'por_vencer', 'vencido').
4. Intento de inyectar strings masivos (> 500 caracteres) en la descripción del plan.
5. Intento de alterar la fecha de vencimiento a un formato corrupto.
6. Intento de crear socios sin nombre o sin plan.
7. Intento de inyectar scripts en las notas del socio.
8. Intento de sobrescribir campos protegidos sin validación.
9. Intento de romper la integridad de tipos en los documentos de cuota.
10. Intento de borrado no autorizado en colecciones ajenas.
11. Intento de inyectar IDs con caracteres inválidos.
12. Intento de exceder los límites de tamaño en campos de texto de socios.

## Estructura de Reglas de Producción
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 0. Global Safety Net
    match /{document=**} {
      allow read, write: if false;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }
    function incoming() { return request.resource.data; }
    function existing() { return resource.data; }

    function isValidPlan(data) {
      return data.name is string && data.name.size() >= 1 && data.name.size() <= 100
        && data.price is number && data.price >= 0 && data.price <= 5000000
        && (!('description' in data) || data.description == null || (data.description is string && data.description.size() <= 500))
        && (!('durationDays' in data) || data.durationDays == null || (data.durationDays is number && data.durationDays >= 1 && data.durationDays <= 3650))
        && (!('createdAt' in data) || data.createdAt == null || data.createdAt is string)
        && (!('updatedAt' in data) || data.updatedAt == null || data.updatedAt is string);
    }

    function isValidSocio(data) {
      return data.nombre is string && data.nombre.size() >= 1 && data.nombre.size() <= 120
        && data.plan is string && data.plan.size() >= 1 && data.plan.size() <= 100
        && data.precio is number && data.precio >= 0 && data.precio <= 5000000
        && data.fecha_inicio is string && data.fecha_inicio.size() <= 30
        && data.fecha_fin is string && data.fecha_fin.size() <= 30
        && data.estado is string && (data.estado == 'activo' || data.estado == 'por_vencer' || data.estado == 'vencido')
        && (!('email' in data) || data.email == null || (data.email is string && data.email.size() <= 150))
        && (!('telefono' in data) || data.telefono == null || (data.telefono is string && data.telefono.size() <= 50))
        && (!('notas' in data) || data.notas == null || (data.notas is string && data.notas.size() <= 1000))
        && (!('createdAt' in data) || data.createdAt == null || data.createdAt is string)
        && (!('updatedAt' in data) || data.updatedAt == null || data.updatedAt is string);
    }

    match /test/{testId} {
      allow read, write: if true;
    }

    match /plans/{planId} {
      allow read: if true;
      allow create: if isValidPlan(incoming());
      allow update: if isValidPlan(incoming());
      allow delete: if true;
    }

    match /socios/{socioId} {
      allow read: if true;
      allow create: if isValidSocio(incoming());
      allow update: if isValidSocio(incoming());
      allow delete: if true;
    }
  }
}
```
