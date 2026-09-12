"use client";

import { useState } from "react";
import type { TransitionEvent } from "react";

/**
 * Держит оверлей в DOM на время его выхода.
 *
 * Без этого закрытие оверлея — это размонтирование, то есть исчезновение в
 * один кадр: вход играет 300 мс, выход не играет вовсе. На сайте так вели
 * себя все шесть общих компонентов хромы — стилист, пейволл, корзина,
 * навигация, cookie, — при том что в файлах страниц (`browse`, `saved`,
 * `builder`) выход давно сделан правильно.
 *
 * Состояние выводится прямо в рендере, а не в эффекте: эффект дал бы лишний
 * каскадный рендер на каждое открытие. Узел уходит из DOM по окончании
 * настоящего перехода, а не по таймеру, — таймер пришлось бы держать в
 * синхроне с длительностью в CSS, и он бы с ней разъезжался.
 *
 * Само движение описывается классами `.ov-*` в `globals.css`: вход через
 * `@starting-style`, выход — через `.is-closing`, и выход короче входа.
 *
 * ```tsx
 * const ov = useOverlayPresence(isOpen);
 * if (!ov.rendered) return null;
 * return (
 *   <div className={ov.cls("ov-scrim")} onTransitionEnd={ov.onTransitionEnd}>
 *     <div className="ov-panel">…</div>
 *   </div>
 * );
 * ```
 */
export function useOverlayPresence(open: boolean) {
  const [rendered, setRendered] = useState(open);

  // Открытие должно быть видно в том же рендере, иначе первый кадр оверлея
  // будет потерян.
  if (open && !rendered) setRendered(true);

  const closing = !open && rendered;

  return {
    /** Держать ли узел в DOM: открыт либо ещё доигрывает выход. */
    rendered,
    /** Идёт выход — на нём висит `.is-closing`. */
    closing,
    /** Добавляет `is-closing` к классам корня оверлея. */
    cls: (base: string) => (closing ? `${base} is-closing` : base),
    /**
     * Вешается на тот же узел, что и `cls`. Реагирует только на собственный
     * переход: всплывший переход ребёнка не должен снимать оверлей раньше
     * времени.
     */
    onTransitionEnd: (e: TransitionEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && closing) setRendered(false);
    },
  };
}
