// shared/validators/limits.ts — Cuánto texto libre acepta el sistema.

/**
 * Tope único para todo lo que escribe una persona: descripciones, títulos,
 * notas y resoluciones.
 *
 * Alcanza para explicar un desperfecto y no tanto como para pegar una novela.
 * Ese texto termina en el título de un ticket, en una notificación push y en
 * las notas de una tarea, así que un campo sin tope no es "flexible": es un
 * campo que rompe las tres cosas.
 *
 * El espejo en la app es `TextLimits.maxText`.
 */
export const MAX_TEXT_LENGTH = 500

/** Un texto de un caracter no describe nada. */
export const MIN_TEXT_LENGTH = 3
