import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { useStore } from "../store/StoreProvider.jsx"
import { useNavigate } from "react-router-dom";
import { formatNumber } from "../utils/index.ts";

const MOVEMENT_RESET_DELAY = 600;
const LAUNCH_THRESHOLD = 800_000;

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

const pickLaunchCandidate = (tokens) =>
  tokens.find(token => token.totalPledged >= LAUNCH_THRESHOLD && token.status === "active");

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

const useTopLaunchDemo = (leader, addPledgeRef, launchCampaignRef, launchDemoRef, setMovements) => {
  useEffect(() => {
    if (launchDemoRef.current || !leader || leader.status !== "active") return;

    const leaderId = leader.id;
    const boostDelta = Math.max(0, LAUNCH_THRESHOLD - leader.totalPledged + 50);
    const boostTimer = setTimeout(() => addPledgeRef.current(leaderId, boostDelta), 6000);

    let removalTimer;
    const launchTimer = setTimeout(() => {
      setMovements(prev => ({ ...prev, [leaderId]: "launch" }));
      removalTimer = setTimeout(() => {
        launchCampaignRef.current(leaderId);
        launchDemoRef.current = true;
      }, MOVEMENT_RESET_DELAY);
    }, 7000);

    return () => {
      clearTimeout(boostTimer);
      clearTimeout(launchTimer);
      if (removalTimer) clearTimeout(removalTimer);
    };
  }, [leader?.id, leader?.status, launchDemoRef, setMovements]);
};

const useScriptedSwapDemo = (getTokensRef, addPledgeRef, swapDemoRef, onFinished) => {
  useEffect(() => {
    if (swapDemoRef.current) return;

    const timers = [];
    const activeTokens = () =>
      getTokensRef.current().filter(token => !token.isSystemToken && token.status !== "launched");

    const findByName = (tokens, name) =>
      tokens.find(t => t.name?.toLowerCase() === name.toLowerCase());

    const steps = [
      { fromName: "ELON", overName: "TRUMP", delay: 1500 },
      { fromName: "WaiFU", overName: "Pengu", delay: 3000 },
      { fromName: "WaiFU", overName: "TRUMP", delay: 4500 },
      { fromName: "WaiFU", overName: "ELON", delay: 6000 },
    ];

    const hasInitialTop = selectTopTokens(activeTokens()).length >= 4;
    if (!hasInitialTop) return;

    const boost = ({ fromName, overName, delay }) => {
      const timer = setTimeout(() => {
        const tokens = selectTopTokens(activeTokens());
        const from = findByName(tokens, fromName);
        const over = findByName(tokens, overName);
        if (!from || !over) return;

        const randomAmount = Math.floor(Math.random() * 10000) + 1000;
        const delta = Math.max(10, over.totalPledged - from.totalPledged + randomAmount);
        addPledgeRef.current(from.id, delta);
      }, delay);
      timers.push(timer);
    };

    steps.forEach(boost);

    const finishTimer = setTimeout(() => {
      swapDemoRef.current = true;
      onFinished?.();
    }, 6500);
    timers.push(finishTimer);

    return () => timers.forEach(clearTimeout);
  }, [addPledgeRef, swapDemoRef, getTokensRef, onFinished]);
};

export const LeaderboardPage = () => {
  const { getTokens, addPledge, launchCampaign } = useStore();
  const [movements, setMovements] = useState({});
  const prevRanksRef = useRef({});
  const swapDemoRef = useRef(false);
  const launchDemoRef = useRef(false);
  const addPledgeRef = useRef(addPledge);
  const launchCampaignRef = useRef(launchCampaign);
  const getTokensRef = useRef(getTokens);
  const dropBottomTokens = useCallback(() => {
    const node = tableRef.current;
    if (!node) return;

    const rows = Array.from(node.querySelectorAll(".leaderboard-row")) as HTMLElement[];
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
    () => getTokens().filter(token => !token.isSystemToken && token.status !== "launched"),
    [getTokens]
  );
  
  const top10Tokens = useMemo(() => selectTopTokens(tokens), [tokens]);
  const navigate = useNavigate();
  
  useEffect(() => { getTokensRef.current = getTokens; }, [getTokens]);

  useMovementTracking(top10Tokens, movements, setMovements, prevRanksRef);
  useScriptedSwapDemo(getTokensRef, addPledgeRef, swapDemoRef, dropBottomTokens);

//   const leader = top10Tokens[0];
//   useTopLaunchDemo(leader, addPledgeRef, launchCampaignRef, launchDemoRef, setMovements);
  
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const rows = Array.from(table.querySelectorAll(".leaderboard-row")) as HTMLElement[];
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