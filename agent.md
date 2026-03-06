
# agent.md

## 1. Propósito del proyecto

Este proyecto está diseñado para ser desarrollado con la ayuda de asistentes de inteligencia artificial y desarrolladores humanos.

El objetivo es garantizar un desarrollo:

- Consistente  
- Seguro  
- Accesible  
- Estable  
- Fácil de mantener a largo plazo  

Principios irrenunciables (orden de prioridad):

1) Seguridad  
2) Estabilidad  
3) Accesibilidad (A11y)  
4) Claridad del código  
5) Mantenibilidad  
6) Rendimiento (performance)

La seguridad y la accesibilidad nunca se negocian.

---

# 2. Idioma obligatorio

Todo el contenido generado debe estar en **español**, incluyendo:

- Comentarios del código  
- Documentación  
- Explicaciones técnicas  
- Nombres descriptivos cuando sea posible  

---

# 3. Tipo de proyecto

Este proyecto es exclusivamente de tipo:

**HTML + CSS + JavaScript (Frontend)**

Se permite el uso de:

- Librerías frontend cuando estén justificadas
- Frameworks frontend si el proyecto lo requiere
- Herramientas de build cuando estén justificadas

No se debe introducir código backend dentro de este proyecto.

---

# 4. Reglas para generación de código con IA

Cuando una IA genere código para este proyecto debe cumplir obligatoriamente las siguientes reglas.

## 4.1 El código debe entregarse siempre completo

La IA debe **entregar siempre el código completo**.

No se permite:

- devolver fragmentos incompletos
- devolver solo partes modificadas
- devolver pseudocódigo
- devolver instrucciones tipo "añade esto en..."

Siempre se debe devolver el **archivo completo listo para usar**.

---

## 4.2 Comentarios obligatorios línea a línea

Todo el código generado debe estar comentado.

Reglas:

- El comentario debe ir **en la línea anterior al código**.
- No usar prefijos como “Comentario:”.
- El comentario debe explicar **qué hace la línea o por qué existe**.
- Priorizar explicar el **por qué**, no solo el qué.

Ejemplo correcto:

```javascript
// Obtenemos el botón de envío del formulario
const botonEnviar = document.querySelector("#enviar");
````

---

## 4.3 Claridad del código

El código debe ser:

* legible
* explícito
* fácil de entender

Reglas obligatorias:

* evitar abreviaturas crípticas
* evitar código innecesariamente complejo
* evitar soluciones "ingeniosas" que reduzcan la legibilidad
* no duplicar lógica innecesariamente

El código debe poder entenderse fácilmente meses después.

---

# 5. Seguridad (PRIORIDAD ABSOLUTA)

Nunca confiar en entradas externas.

Reglas obligatorias:

* validar toda entrada de usuario
* sanitizar datos antes de utilizarlos
* no usar `innerHTML` con contenido no sanitizado
* evitar `eval()` o ejecución dinámica de código
* no exponer claves privadas ni tokens

Si se consumen APIs externas:

* manejar errores correctamente
* no mostrar información interna del sistema al usuario

El frontend nunca debe contener secretos.

---

# 6. Accesibilidad (A11y)

Todo el código debe cumplir buenas prácticas de accesibilidad.

Reglas obligatorias:

* usar HTML semántico
* todos los inputs deben tener `label`
* todas las imágenes deben tener atributo `alt`
* navegación por teclado funcional
* foco visible en elementos interactivos
* evitar usar solo color para transmitir información

La accesibilidad forma parte de la calidad del software.

---

# 7. Rendimiento (performance)

El código debe priorizar rendimiento.

Reglas obligatorias:

* evitar manipulaciones innecesarias del DOM
* evitar listeners innecesarios en scroll o resize
* usar debounce o throttle cuando aplique
* optimizar imágenes
* evitar dependencias innecesarias

---

# 8. Calidad del código

El código debe mantenerse limpio y consistente.

Reglas:

* evitar variables sin usar
* evitar CSS duplicado
* mantener nombres consistentes
* evitar código muerto

---

# 9. Estructura recomendada

El proyecto debe organizarse con una estructura clara.

Ejemplo de estructura recomendada:

```
/src
/css
/js
/img
/docs
```

Cada parte del proyecto debe tener una responsabilidad clara.

---

# 10. Reglas para modificaciones de código

Cuando la IA modifique código existente:

* debe analizar primero el código actual
* debe mantener la coherencia con el estilo existente
* no debe eliminar código sin verificar su uso
* no debe introducir cambios innecesarios

Los cambios deben ser **mínimos y justificados**.

---

# 11. Responsabilidad del asistente IA

El asistente debe comportarse como un **desarrollador senior responsable**.

Reglas:

* no improvisar soluciones inseguras
* no ignorar buenas prácticas
* no sacrificar claridad por rapidez
* priorizar seguridad, estabilidad y mantenimiento

El objetivo no es solo generar código.

El objetivo es generar **buen software**.


