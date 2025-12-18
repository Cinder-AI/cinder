import React, { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useStore } from "../store/StoreProvider.jsx";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../utils/index.ts";
import { gsap } from "gsap";

const selectTopTokens = (tokens) =>
  tokens.slice().sort((a, b) => b.totalPledged - a.totalPledged).slice(0, 10);

const buildRowClass = () => "leaderboard-row";

export const LeaderboardPage = () => {
  const { getLeaderboardTokens, addLeaderboardPledge } = useStore();
  const tableRef = useRef(null);
  const hideTimerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const isScrollableRef = useRef(false);
  const positions1to5Refs = useRef([]);
  const positions6to9Refs = useRef([]);
  const previousTokensRef = useRef([]);
  const animationInProgressRef = useRef(false);
  const dropAnimationPlayedRef = useRef(false);
  const scenarioPlayedRef = useRef(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const SCROLL_HIDE_DELAY = 500;

  const syncScrollable = useCallback(() => {
    const node = tableRef.current;
    if (!node) return;
    const scrollable = node.scrollHeight - node.clientHeight > 1;
    setIsScrollable(scrollable);
    isScrollableRef.current = scrollable;
    if (!scrollable && isScrollingRef.current) {
      setIsScrolling(false);
      clearTimeout(hideTimerRef.current);
    }
  }, []);

  useEffect(() => {
    syncScrollable();
    const node = tableRef.current;
    if (!node) return;

    const observer = new ResizeObserver(syncScrollable);
    observer.observe(node);
    window.addEventListener("resize", syncScrollable);

    const handleScroll = () => {
      if (!isScrollableRef.current) return;
      setIsScrolling(true);
      isScrollingRef.current = true;
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;
        setIsScrolling(false);
      }, SCROLL_HIDE_DELAY);
    };

    node.addEventListener("scroll", handleScroll);

    return () => {
      node.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncScrollable);
      observer.disconnect();
      clearTimeout(hideTimerRef.current);
    };
  }, [syncScrollable]);

  const tokens = useMemo(
    () => getLeaderboardTokens().filter(token => !token.isSystemToken && token.status !== "launched"),
    [getLeaderboardTokens]
  );
  const top10Tokens = useMemo(() => selectTopTokens(tokens), [tokens]);
  const navigate = useNavigate();

  // Функция для поиска элемента токена по ID
  const findTokenElement = useCallback((tokenId) => {
    return Array.from(tableRef.current?.querySelectorAll('[data-token-id]') || [])
      .find(el => parseInt(el.getAttribute('data-token-id')) === tokenId);
  }, []);

  // Функция для обмена местами двух токенов по их ID
  const swapTokens = useCallback((tokenId1, tokenId2, timeline, position) => {
    const element1 = findTokenElement(tokenId1);
    const element2 = findTokenElement(tokenId2);
    
    if (!element1 || !element2) {
      console.warn(`Не найдены элементы для токенов ${tokenId1} и ${tokenId2}`);
      return;
    }

    // Получаем актуальные позиции элементов
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    const distance = rect2.top - rect1.top;

    const rank1Element = element1.querySelector('.leaderboard-rank, .leaderboard-rank--gold');
    const rank2Element = element2.querySelector('.leaderboard-rank, .leaderboard-rank--gold');

    // Сбрасываем предыдущие трансформации
    gsap.set([element1, element2], {
      position: "relative",
      zIndex: 2000,
      y: 0,
      clearProps: "transform"
    });

    // Создаем метку для этой анимации
    const swapLabel = `swap_${tokenId1}_${tokenId2}_${Date.now()}`;
    timeline.addLabel(swapLabel, position);

    // Анимация движения токенов
    timeline.to(element1, {
      y: distance,
      duration: 0.6,
      ease: "power2.inOut",
    }, swapLabel);

    timeline.to(element2, {
      y: -distance,
      duration: 0.6,
      ease: "power2.inOut",
    }, swapLabel);

    // Обмениваем ранги в середине анимации
    timeline.call(() => {
      if (rank1Element && rank2Element) {
        const tempRank = rank1Element.textContent;
        rank1Element.textContent = rank2Element.textContent;
        rank2Element.textContent = tempRank;
      }
    }, null, `${swapLabel}+=0.3`);

    // Сбрасываем трансформации после завершения анимации
    timeline.call(() => {
      gsap.set([element1, element2], { 
        zIndex: 1,
        y: 0,
        clearProps: "transform"
      });
    }, null, `${swapLabel}+=0.6`);
  }, [findTokenElement]);

  // Функция для обновления значения депозита БЕЗ анимации
  const updatePledgedValue = useCallback((element, newValue) => {
    const pledgedElement = element.querySelector('.leaderboard-pledged');
    if (pledgedElement) {
      pledgedElement.textContent = `${formatNumber(newValue)} stFUEL`;
    }
  }, []);

  // Запуск сценария анимаций
  useEffect(() => {
    if (scenarioPlayedRef.current || animationInProgressRef.current) return;
    
    const top5Elements = positions1to5Refs.current.filter(Boolean);
    const bottomElements = positions6to9Refs.current.filter(Boolean);
    
    if (top5Elements.length < 4 || bottomElements.length === 0) return;

    // Ждем немного для инициализации
    const timeoutId = setTimeout(() => {
      scenarioPlayedRef.current = true;
      animationInProgressRef.current = true;
      
      const viewportHeight = window.innerHeight;
      const masterTl = gsap.timeline({
        onComplete: () => {
          animationInProgressRef.current = false;
        }
      });

      // Получаем текущие токены
      const currentTop5 = top10Tokens.slice(0, 5);
      const elonToken = currentTop5.find(t => t.id === 4); // ELON
      const trumpToken = currentTop5.find(t => t.id === 14); // TRUMP
      const waifuToken = currentTop5.find(t => t.id === 3); // WAIFU
      const pepeToken = currentTop5.find(t => t.id === 8); // PEPE

      if (!elonToken || !trumpToken || !waifuToken || !pepeToken) {
        animationInProgressRef.current = false;
        return;
      }

      const elonElement = findTokenElement(4);
      const trumpElement = findTokenElement(14);
      const waifuElement = findTokenElement(3);
      const pepeElement = findTokenElement(8);

      if (!elonElement || !trumpElement || !waifuElement || !pepeElement) {
        animationInProgressRef.current = false;
        return;
      }

      // Шаг 1: ELON получает +30000 и обгоняет TRUMP
      const elonNewValue = elonToken.totalPledged + 30000;

      masterTl.call(() => {
        updatePledgedValue(elonElement, elonNewValue);
        addLeaderboardPledge(4, 30000);
      });

      // Обгон ELON -> TRUMP (ждем завершения обновления значения)
      masterTl.call(() => {
        swapTokens(4, 14, masterTl, "+=0.1");
      });

      // Шаг 2: WAIFU поднимается до 1-го места
      const waifuStep1Value = waifuToken.totalPledged + 80000;
      const waifuStep2Value = waifuStep1Value + 85000;
      const waifuFinalValue = waifuStep2Value + 10000;

      // WAIFU обгоняет PEPE (4->3) - ждем завершения предыдущего свапа (0.6 + 0.1 = 0.7)
      masterTl.call(() => {
        updatePledgedValue(waifuElement, waifuStep1Value);
        addLeaderboardPledge(3, 80000);
      }, null, "+=0.3");

      masterTl.call(() => {
        swapTokens(3, 8, masterTl, "+=0.1");
      });

      // WAIFU обгоняет ELON (3->2) - ждем завершения предыдущего свапа
      masterTl.call(() => {
        updatePledgedValue(waifuElement, waifuStep2Value);
        addLeaderboardPledge(3, 85000);
      }, null, "+=0.5");

      masterTl.call(() => {
        swapTokens(3, 4, masterTl, "+=0.1");
      });

      // WAIFU обгоняет TRUMP (2->1) - ждем завершения предыдущего свапа
      masterTl.call(() => {
        updatePledgedValue(waifuElement, waifuFinalValue);
        addLeaderboardPledge(3, 10000);
      }, null, "+=0.5");

      masterTl.call(() => {
        swapTokens(3, 14, masterTl, "+=0.1");
      });

      // Шаг 3: Анимация выпадения токенов 6-9
      masterTl.call(() => {
        bottomElements.forEach((element, idx) => {
          const elementRect = element.getBoundingClientRect();
          const startY = elementRect.top;

          gsap.set(element, {
            position: "relative",
            zIndex: 1000 - idx,
          });

          masterTl.to(element, {
            y: viewportHeight - startY + 100,
            opacity: 0,
            duration: 0.8,
            ease: "power2.in",
            onComplete: () => {
              gsap.set(element, { visibility: "hidden" });
            }
          }, idx === 0 ? "+=0.2" : `+=${0.05}`);
        });
      }, null, "+=0.3");

    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [top10Tokens, swapTokens, updatePledgedValue, findTokenElement, addLeaderboardPledge]);

  const renderLeaderboard = () => {
    return top10Tokens.map((token, index) => {
      const rankClass = index < 5 ? "leaderboard-rank--gold" : "leaderboard-rank";
      const isPosition1to5 = index < 5;
      const isPosition6to9 = index >= 5 && index <= 8;
      return (
        <div
          key={token.id}
          data-token-id={token.id}
          ref={(el) => {
            if (isPosition1to5) {
              positions1to5Refs.current[index] = el;
            } else if (isPosition6to9) {
              const refIndex = index - 5;
              positions6to9Refs.current[refIndex] = el;
            }
          }}
          className={buildRowClass()}
          onClick={() => navigate(`/token/${token.id}`)}
        >
          <div className={rankClass}>#{index + 1}</div>
          <div className="leaderboard-image">
            <img src={token.image} alt={token.name} />
          </div>
          <div className="leaderboard-ticker">{token.ticker}</div>
          <div className="leaderboard-pledged">
            {formatNumber(token.totalPledged)} stFUEL
          </div>
        </div>
      );
    });
  };

  return (
    <div className="leaderboard-page">
      <h1 className="leaderboard-title">Leaderboard</h1>
      <div ref={tableRef} className={`leaderboard-table ${isScrolling ? "leaderboard-table--scrolling" : ""}`}>
        {renderLeaderboard()}
      </div>
    </div>
  );
};

