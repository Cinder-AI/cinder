import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { useStore } from "../store/StoreProvider.jsx"
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../utils/index.ts";

const MOVEMENT_RESET_DELAY = 600;

const selectTopTokens = (tokens) =>
  tokens.slice().sort((a, b) => b.totalPledged - a.totalPledged).slice(0, 10);

const buildRankMap = (tokens) =>
  tokens.reduce((acc, token, index) => {
    acc[token.id] = index;
    return acc;
  }, {});

const buildRowClass = (movements, tokenId) => 
  [
    "leaderboard-row",
    movements[tokenId] === "up" && "leaderboard-row--up",
    movements[tokenId] === "down" && "leaderboard-row--down",
    movements[tokenId] === "launch" && "leaderboard-row--launch",
  ].filter(Boolean).join(" ");


const detectMovements = (current, prevRanks) => 
  current.reduce((acc, token, idx) => {
    const prevIdx = prevRanks[token.id];
    if (prevIdx !== undefined && prevIdx !== idx) {
      acc[token.id] = prevIdx > idx ? "up" : "down";
    }
    return acc;
  }, {});

const useMovementTracking = (tokens, movements, setMovements, prevRanksRef) => {
  useEffect(() => {
    const rankMap = buildRankMap(tokens);
    setMovements(detectMovements(tokens, prevRanksRef.current));
    prevRanksRef.current = rankMap;
  }, [tokens, setMovements, prevRanksRef]);

  useEffect(() => {
    if (!Object.keys(movements).length) return;
    const timer = setTimeout(() => setMovements({}), MOVEMENT_RESET_DELAY);
    return () => clearTimeout(timer);
  }, [movements, setMovements]);
};

export const LeaderboardPage = () => {
  const { getTokens } = useStore();
  const [movements, setMovements] = useState({});
  const prevRanksRef = useRef({});
  const getTokensRef = useRef(getTokens);
  const dropBottomTokens = useCallback(() => {
    const node = tableRef.current;
    if (!node) return;

    const rows = Array.from(node.querySelectorAll(".leaderboard-row"));
    const bottom = rows.slice(5, 9); // позиции 6–9
    const viewportHeight = window.innerHeight;

    bottom.forEach((element, idx) => {
      const { top } = element.getBoundingClientRect();
      gsap.set(element, { position: "relative", zIndex: 1000 - idx });
      gsap.to(element, {
        y: viewportHeight - top + 100,
        opacity: 0,
        duration: 0.8,
        ease: "power2.in",
        delay: idx === 0 ? 0.2 : 0.2 + idx * 0.05,
        onComplete: () => gsap.set(element, { visibility: "hidden" }),
      });
    });
  }, []);
  const SCROLL_HIDE_DELAY = 500;
  const tableRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const hideTimerRef = useRef(null);
  const positionsRef = useRef(new Map());

  const syncScrollable = useCallback(() => {
    const node = tableRef.current;
    if (!node) return;
    const scrollable = node.scrollHeight - node.clientHeight > 1;
    setIsScrollable(scrollable);
    if (!scrollable && isScrolling) {
      setIsScrolling(false);
      clearTimeout(hideTimerRef.current);
    }

  }, [isScrolling]);

  useEffect(() => {
    syncScrollable();
    const node = tableRef.current;
    if (!node) return;

    const observer = new ResizeObserver(syncScrollable);
    observer.observe(node);
    window.addEventListener("resize", syncScrollable);

    const handleScroll = () => {
      if (!isScrollable) return;
      setIsScrolling(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setIsScrolling(false), SCROLL_HIDE_DELAY);
    };

    node.addEventListener("scroll", handleScroll);

    return () => {
      node.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", syncScrollable);
      observer.disconnect();
      clearTimeout(hideTimerRef.current);
    };
  }, [isScrollable, syncScrollable]);

  const tokens = useMemo(
    () =>
      getTokens().filter(
        token =>
          !token.isSystemToken &&
          String(token.status || '').toLowerCase() !== 'launched',
      ),
    [getTokens],
  );
  
  const top10Tokens = useMemo(() => selectTopTokens(tokens), [tokens]);
  const navigate = useNavigate();
  
  useEffect(() => { getTokensRef.current = getTokens; }, [getTokens]);

  useMovementTracking(top10Tokens, movements, setMovements, prevRanksRef);
  // Demo flow removed: leaderboard now reflects indexer data only.
  
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const rows = Array.from(table.querySelectorAll(".leaderboard-row"));
    const prev = positionsRef.current;
    const next = new Map();

    rows.forEach(row => next.set(row.dataset.tokenId, row.getBoundingClientRect()));

    const ctx = gsap.context(() => {
      rows.forEach(row => {
        const id = row.dataset.tokenId;
        const prevBox = prev.get(id);
        const nextBox = next.get(id);
        if (!prevBox || !nextBox) return;

        const dx = prevBox.left - nextBox.left;
        const dy = prevBox.top - nextBox.top;
        if (dx || dy) {
          gsap.fromTo(
            row,
            { x: dx, y: dy, opacity: 0.9 },
            { x: 0, y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }
          );
        }
      });
    }, table);

    positionsRef.current = next;
    return () => ctx.revert();
  }, [top10Tokens]);

  const renderLeaderboard = () => {
    return top10Tokens.map((token, index) => {
      const rankClass = index < 5 ? "leaderboard-rank--gold" : "leaderboard-rank";
      return (
        <div
          key={token.id}
          data-token-id={token.id}
          className={buildRowClass(movements, token.id)}
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
      )
    });
  }

  return (
    <div className="leaderboard-page">
      <h1 className="leaderboard-title">Leaderboard</h1>
      <div ref={tableRef} className={`leaderboard-table ${isScrolling ? "leaderboard-table--scrolling" : ""}`}>
        {renderLeaderboard()}
      </div>
    </div>
  )
}