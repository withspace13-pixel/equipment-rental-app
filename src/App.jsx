import React, { useState, useEffect, useCallback } from 'react';

// 관리할 장비 목록
const BASE_ITEM_TYPES = [
  {
    id: 'bw',
    name: '흑백프린터',
    icon: '🖨️',
    color: 'text-gray-700 bg-gray-100',
  },
  {
    id: 'color',
    name: '컬러프린터',
    icon: '🎨',
    color: 'text-blue-700 bg-blue-100',
  },
  {
    id: 'tv',
    name: 'TV',
    icon: '📺',
    color: 'text-red-700 bg-red-100',
  },
];

const DEFAULT_PRICING = {
  bw: { upTo3: 80000, day4to5: 110000, extraPerDay: 8000 },
  color: { upTo3: 100000, day4to5: 140000, extraPerDay: 10000 },
  tv: { base: 300000, extraPerDay: 30000 },
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString()}원`;

const buildItemDescription = (itemId, pricing) => {
  if (itemId === 'tv') {
    return `기본 ${formatMoney(pricing.tv.base)} / 연속 1일 추가 +${formatMoney(pricing.tv.extraPerDay)}`;
  }
  if (itemId === 'color') {
    return `1~3일 ${formatMoney(pricing.color.upTo3)} / 4~5일 ${formatMoney(pricing.color.day4to5)} / 6일~ +${formatMoney(pricing.color.extraPerDay)}`;
  }
  return `1~3일 ${formatMoney(pricing.bw.upTo3)} / 4~5일 ${formatMoney(pricing.bw.day4to5)} / 6일~ +${formatMoney(pricing.bw.extraPerDay)}`;
};

// 계단식 요금 계산 핵심 로직 함수
const calculateItemCost = (itemId, days, pricing) => {
  if (days <= 0) return 0;

  if (itemId === 'tv') {
    return pricing.tv.base + (days - 1) * pricing.tv.extraPerDay;
  } else if (itemId === 'color') {
    if (days <= 3) return pricing.color.upTo3;
    if (days <= 5) return pricing.color.day4to5;
    return pricing.color.day4to5 + (days - 5) * pricing.color.extraPerDay;
  } else if (itemId === 'bw') {
    if (days <= 3) return pricing.bw.upTo3;
    if (days <= 5) return pricing.bw.day4to5;
    return pricing.bw.day4to5 + (days - 5) * pricing.bw.extraPerDay;
  }
  return 0;
};

// YYYY-MM-DD 포맷 함수
const formatDate = (y, m, d) => {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// `new Date('YYYY-MM-DD')`는 타임존에 따라 날짜가 밀릴 수 있어 로컬 기준으로 파싱
const parseDateStr = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
};

// 다음 날짜 구하기
const getNextDateStr = (dateStr) => {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + 1);
  return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
};

// 💡 날짜 기간 포맷팅 함수 (예: 3/23~27, 3/28~4/2, 3/23)
const formatPeriod = (startStr, endStr) => {
  if (!startStr || !endStr) return '';
  const sParts = startStr.split('-');
  const eParts = endStr.split('-');
  const sm = parseInt(sParts[1], 10);
  const sd = parseInt(sParts[2], 10);
  const em = parseInt(eParts[1], 10);
  const ed = parseInt(eParts[2], 10);

  if (startStr === endStr) return `(${sm}/${sd})`;
  if (sm === em) return `(${sm}/${sd}~${ed})`;
  return `(${sm}/${sd}~${em}/${ed})`;
};

// 💡 상세 견적 텍스트 포맷팅 (예: (기본 1일 300,000원 + 추가 4일 x 30,000원) x 1대)
const formatCostBreakdown = (itemId, days, qty, pricing) => {
  if (itemId === 'tv') {
    if (days === 1) return `(기본 1일 ${formatMoney(pricing.tv.base)}) × ${qty}대`;
    return `(기본 1일 ${formatMoney(pricing.tv.base)} + 추가 ${days - 1}일 × ${formatMoney(pricing.tv.extraPerDay)}) × ${qty}대`;
  } else if (itemId === 'color') {
    if (days <= 3) return `(기본 ${days}일 ${formatMoney(pricing.color.upTo3)}) × ${qty}대`;
    if (days <= 5) return `(기본 ${days}일 ${formatMoney(pricing.color.day4to5)}) × ${qty}대`;
    return `(기본 5일 ${formatMoney(pricing.color.day4to5)} + 추가 ${days - 5}일 × ${formatMoney(pricing.color.extraPerDay)}) × ${qty}대`;
  } else if (itemId === 'bw') {
    if (days <= 3) return `(기본 ${days}일 ${formatMoney(pricing.bw.upTo3)}) × ${qty}대`;
    if (days <= 5) return `(기본 ${days}일 ${formatMoney(pricing.bw.day4to5)}) × ${qty}대`;
    return `(기본 5일 ${formatMoney(pricing.bw.day4to5)} + 추가 ${days - 5}일 × ${formatMoney(pricing.bw.extraPerDay)}) × ${qty}대`;
  }
  return '';
};

export default function App() {
  const [viewMode, setViewMode] = useState('list');
  const [pricing, setPricing] = useState(() => {
    try {
      const saved = localStorage.getItem('pricingConfig');
      if (!saved) return DEFAULT_PRICING;
      return { ...DEFAULT_PRICING, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_PRICING;
    }
  });
  const itemTypes = BASE_ITEM_TYPES.map((item) => ({
    ...item,
    desc: buildItemDescription(item.id, pricing),
  }));

  // --- 1. 달력 뷰 상태 ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState({});
  const [copiedData, setCopiedData] = useState(null);

  // --- 2. 목록형 뷰 상태 ---
  const [listData, setListData] = useState(() => {
    const initial = {};
    BASE_ITEM_TYPES.forEach((t) => (initial[t.id] = []));
    return initial;
  });

  // --- 3. 공통 상태 ---
  const [toastMessage, setToastMessage] = useState('');
  const [includeWeekend, setIncludeWeekend] = useState(false); // 기본값을 false(주말 미포함)로 변경
  const [calcResult, setCalcResult] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2000);
  }, []);

  const handleTabChange = (mode) => {
    setViewMode(mode);
    setCalcResult(null);
  };

  useEffect(() => {
    localStorage.setItem('pricingConfig', JSON.stringify(pricing));
  }, [pricing]);

  const handlePricingChange = (itemId, field, value) => {
    const parsed = Math.max(0, parseInt(value, 10) || 0);
    setPricing((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: parsed,
      },
    }));
    setCalcResult(null);
  };

  const removeItemEverywhere = (itemId) => {
    setEvents((prev) => {
      const next = {};
      Object.entries(prev).forEach(([date, dayData]) => {
        const updatedDayData = { ...dayData };
        delete updatedDayData[itemId];
        if (Object.values(updatedDayData).some((qty) => qty > 0)) {
          next[date] = updatedDayData;
        }
      });
      return next;
    });

    setListData((prev) => ({
      ...prev,
      [itemId]: [],
    }));

    setCalcResult(null);
    showToast('해당 장비가 전체 일정/계산에서 삭제되었습니다.');
  };

  // --- 달력 뷰 단축키 ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== 'calendar') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let targetDateObj;
        if (selectedDate) {
          const [y, m, d] = selectedDate.split('-').map(Number);
          targetDateObj = new Date(y, m - 1, d);
        } else {
          targetDateObj = new Date();
        }

        if (e.key === 'ArrowRight') targetDateObj.setDate(targetDateObj.getDate() + 1);
        else if (e.key === 'ArrowLeft') targetDateObj.setDate(targetDateObj.getDate() - 1);
        else if (e.key === 'ArrowDown') targetDateObj.setDate(targetDateObj.getDate() + 7);
        else if (e.key === 'ArrowUp') targetDateObj.setDate(targetDateObj.getDate() - 7);

        const newDateStr = formatDate(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate());
        setSelectedDate(newDateStr);
        setCurrentDate(new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), 1));
        return;
      }

      if (!selectedDate) return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key === 'c') {
        const dataToCopy = events[selectedDate];
        if (dataToCopy && Object.values(dataToCopy).some((val) => val > 0)) {
          setCopiedData(dataToCopy);
          showToast(`📋 ${selectedDate} 수량 복사됨!`);
        }
      }

      if (isCtrlOrCmd && e.key === 'v') {
        if (copiedData) {
          setEvents((prev) => ({ ...prev, [selectedDate]: { ...copiedData } }));
          showToast(`✨ ${selectedDate} 붙여넣기 완료!`);
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (events[selectedDate]) {
          setEvents((prev) => {
            const newEvents = { ...prev };
            delete newEvents[selectedDate];
            return newEvents;
          });
          showToast(`🗑️ 수량 초기화됨`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, events, copiedData, viewMode, showToast]);

  const handleCalendarItemChange = (itemId, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setEvents((prev) => ({
      ...prev,
      [selectedDate]: { ...(prev[selectedDate] || {}), [itemId]: numValue },
    }));
  };

  const addListSchedule = (itemId) => {
    setListData((prev) => ({
      ...prev,
      [itemId]: [
        ...prev[itemId],
        { id: Date.now() + Math.random(), startDate: todayStr, endDate: todayStr, qty: 1 },
      ],
    }));
  };

  const removeListSchedule = (itemId, scheduleId) => {
    setListData((prev) => ({
      ...prev,
      [itemId]: prev[itemId].filter((s) => s.id !== scheduleId),
    }));
  };

  const updateListSchedule = (itemId, scheduleId, field, value) => {
    setListData((prev) => ({
      ...prev,
      [itemId]: prev[itemId].map((s) => (s.id === scheduleId ? { ...s, [field]: value } : s)),
    }));
  };

  // 💰 통합 계산 로직
  const handleCalculate = () => {
    let totalCost = 0;
    const details = itemTypes.reduce((acc, type) => ({ ...acc, [type.id]: { cost: 0, blocks: [] } }), {});
    const allActiveDates = new Set();

    if (viewMode === 'calendar') {
      const sortedDates = Object.keys(events).sort();
      const billableDates = sortedDates.filter((dateStr) => {
        const d = parseDateStr(dateStr);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        return includeWeekend || !isWeekend;
      });

      billableDates.forEach((d) => {
        if (itemTypes.some((t) => events[d] && events[d][t.id] > 0)) allActiveDates.add(d);
      });

      itemTypes.forEach((type) => {
        const dayCounts = billableDates.map((dateStr) => ({
          dateStr,
          qty: (events[dateStr] && events[dateStr][type.id]) || 0,
        }));

        const segments = [];
        let currentSegment = [];
        for (let i = 0; i < dayCounts.length; i++) {
          if (currentSegment.length === 0) {
            currentSegment.push(dayCounts[i]);
          } else {
            const prevDateStr = currentSegment[currentSegment.length - 1].dateStr;
            let nextExpected = getNextDateStr(prevDateStr);
            while (
              !includeWeekend &&
              (parseDateStr(nextExpected).getDay() === 0 || parseDateStr(nextExpected).getDay() === 6)
            ) {
              nextExpected = getNextDateStr(nextExpected);
            }

            if (dayCounts[i].dateStr === nextExpected) {
              currentSegment.push(dayCounts[i]);
            } else {
              segments.push(currentSegment);
              currentSegment = [dayCounts[i]];
            }
          }
        }
        if (currentSegment.length > 0) segments.push(currentSegment);

        segments.forEach((segment) => {
          const qtys = segment.map((d) => d.qty);
          while (true) {
            let startIdx = -1;
            for (let i = 0; i < qtys.length; i++) {
              if (qtys[i] > 0) {
                startIdx = i;
                break;
              }
            }
            if (startIdx === -1) break;

            let endIdx = startIdx;
            for (let i = startIdx + 1; i < qtys.length; i++) {
              if (qtys[i] > 0) {
                endIdx = i;
              } else {
                break;
              }
            }

            let minQty = qtys[startIdx];
            for (let i = startIdx; i <= endIdx; i++) {
              if (qtys[i] < minQty) minQty = qtys[i];
            }

            const days = endIdx - startIdx + 1;
            const cost = calculateItemCost(type.id, days, pricing) * minQty;
            details[type.id].cost += cost;
            totalCost += cost;

            // 💡 캘린더 모드에서도 시작일~종료일을 명확하게 저장
            details[type.id].blocks.push({
              days,
              qty: minQty,
              startDate: segment[startIdx].dateStr,
              endDate: segment[endIdx].dateStr,
            });

            for (let i = startIdx; i <= endIdx; i++) qtys[i] -= minQty;
          }
        });
      });
    } else {
      // 목록형 뷰 계산
      itemTypes.forEach((type) => {
        const schedules = listData[type.id] || [];
        schedules.forEach((sched) => {
          if (!sched.startDate || !sched.endDate || sched.qty <= 0) return;
          const start = parseDateStr(sched.startDate);
          const end = parseDateStr(sched.endDate);
          if (start > end) return;

          let current = new Date(start);
          let itemActiveDays = 0;

          while (current <= end) {
            const dayOfWeek = current.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (includeWeekend || !isWeekend) {
              itemActiveDays++;
              allActiveDates.add(current.getTime());
            }
            current.setDate(current.getDate() + 1);
          }

          if (itemActiveDays > 0) {
            const cost = calculateItemCost(type.id, itemActiveDays, pricing) * sched.qty;
            details[type.id].cost += cost;
            totalCost += cost;
            // 💡 시작일~종료일 저장
            details[type.id].blocks.push({
              days: itemActiveDays,
              qty: sched.qty,
              startDate: sched.startDate,
              endDate: sched.endDate,
            });
          }
        });
      });
    }

    const activeDaysCount = allActiveDates.size;

    // 📝 비고란용 텍스트 및 UI 블록 생성 (복구된 포맷팅 로직 적용)
    let quoteText = '';
    let hasItems = false;
    const blockStrsForUI = {};
    const itemSections = [];

    itemTypes.forEach((type) => {
      const detail = details[type.id];
      blockStrsForUI[type.id] = [];

      if (detail.blocks.length > 0) {
        hasItems = true;
        let sectionText = `[${type.name} 견적 내역]\n`;
        let itemTotalCost = 0;

        detail.blocks.forEach((b) => {
          // (3/23~27) 같은 날짜 포맷
          const periodStr = formatPeriod(b.startDate, b.endDate);
          // (기본 1일 300,000원 + 추가 4일 x 30,000원) x 1대 같은 상세 설명
          const breakdownStr = formatCostBreakdown(type.id, b.days, b.qty, pricing);
          // 이 블록의 최종 금액
          const blockCost = calculateItemCost(type.id, b.days, pricing) * b.qty;
          itemTotalCost += blockCost;

          sectionText += `  ${breakdownStr} ${periodStr} = ${blockCost.toLocaleString()}원\n`;
          blockStrsForUI[type.id].push(`${breakdownStr} ${periodStr}`);
        });
        sectionText += `* ${type.name} 합계: ${itemTotalCost.toLocaleString()}원\n`;
        itemSections.push(sectionText);
      }
    });

    if (!hasItems) {
      showToast('입력된 장비 수량이 없거나 기간이 올바르지 않습니다.');
      setCalcResult(null);
      return;
    }

    // 장비별 내역을 구분선으로 연결 (맨 아래 총계 부분 삭제)
    quoteText = itemSections.join(`-------------------------\n`);

    setCalcResult({ totalCost, details, activeDaysCount, quoteText, blockStrsForUI });
  };

  const copyQuoteText = () => {
    if (!calcResult?.quoteText) return;
    const textArea = document.createElement('textarea');
    textArea.value = calcResult.quoteText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('✅ 견적 내용이 복사되었습니다.');
    } catch (err) {
      showToast('❌ 복사에 실패했습니다.');
    }
    document.body.removeChild(textArea);
  };

  const renderListMode = () => {
    return (
      <div className="bg-white rounded-b-2xl shadow-xl overflow-hidden border border-t-0 border-gray-200 p-6 md:p-8">
        <div className="mb-6 flex justify-between items-end">
          <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">📝 장비별 일정 목록</h2>
          <span className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded border shadow-sm hidden md:block">
            💡 항목별로 <strong>[+ 일정 추가]</strong> 버튼을 눌러 여러 기간을 설정하세요.
          </span>
        </div>

        <div className="space-y-6">
          {itemTypes.map((type) => (
            <div
              key={type.id}
              className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-gray-50/50 transition-colors focus-within:border-blue-300"
            >
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 border-b border-gray-200">
                <div className="flex items-center gap-3 w-full sm:w-auto mb-3 sm:mb-0">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl ${type.color}`}>
                    {type.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{type.name}</h3>
                    <p className="text-xs text-gray-500 font-medium tracking-tight">단가: {type.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => addListSchedule(type.id)}
                  className="w-full sm:w-auto bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-1 shadow-sm"
                >
                  <span className="text-lg leading-none">+</span> 일정 추가
                </button>
              </div>

              <div className="p-4 space-y-3">
                {listData[type.id].length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">등록된 렌탈 일정이 없습니다.</div>
                ) : (
                  listData[type.id].map((sched, idx) => (
                    <div
                      key={sched.id}
                      className="flex flex-wrap items-center gap-3 bg-white p-3 border border-gray-200 rounded-lg shadow-sm relative pr-10"
                    >
                      <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-1 rounded-full">#{idx + 1}</span>
                      <div className="flex items-center gap-2 flex-grow">
                        <input
                          type="date"
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                          value={sched.startDate}
                          onChange={(e) => updateListSchedule(type.id, sched.id, 'startDate', e.target.value)}
                        />
                        <span className="text-gray-400 font-bold">~</span>
                        <input
                          type="date"
                          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                          value={sched.endDate}
                          onChange={(e) => updateListSchedule(type.id, sched.id, 'endDate', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">수량:</span>
                        <input
                          type="number"
                          min="1"
                          className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700"
                          value={sched.qty}
                          onChange={(e) =>
                            updateListSchedule(type.id, sched.id, 'qty', Math.max(1, parseInt(e.target.value) || 0))
                          }
                        />
                        <span className="text-sm text-gray-600">대</span>
                      </div>
                      <button
                        onClick={() => removeListSchedule(type.id, sched.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-red-300 hover:text-red-600 transition-colors p-1"
                        title="이 일정 삭제"
                      >
                        ❌
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCalendarMode = () => {
    const calendarDays = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--)
      calendarDays.push({
        date: formatDate(year, month - 1, daysInPrevMonth - i),
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    for (let i = 1; i <= daysInMonth; i++)
      calendarDays.push({ date: formatDate(year, month, i), day: i, isCurrentMonth: true });
    const remainingDays = 42 - calendarDays.length;
    for (let i = 1; i <= remainingDays; i++)
      calendarDays.push({ date: formatDate(year, month + 1, i), day: i, isCurrentMonth: false });

    return (
      <>
        <div className="bg-white rounded-b-2xl shadow-xl overflow-hidden border border-t-0 border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ◀
            </button>
            <h2 className="text-2xl font-bold text-gray-700">
              {year}년 {month + 1}월
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ▶
            </button>
          </div>
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
              <div
                key={day}
                className={`py-3 text-center text-sm font-semibold ${
                  idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-gray-200 gap-[1px]">
            {calendarDays.map((item) => {
              const isSelected = selectedDate === item.date;
              const isToday = todayStr === item.date;
              const dayData = events[item.date] || {};
              const dayOfWeek = parseDateStr(item.date).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isExcluded = !includeWeekend && isWeekend;
              const activeItems = itemTypes.filter((type) => dayData[type.id] > 0);

              return (
                <div
                  key={item.date}
                  onClick={() => setSelectedDate(item.date)}
                  className={`min-h-[120px] bg-white p-2 cursor-pointer transition-all relative flex flex-col ${
                    !item.isCurrentMonth ? 'text-gray-400 bg-gray-50' : 'text-gray-700'
                  } ${isSelected ? 'ring-2 ring-blue-500 ring-inset z-10 bg-blue-50' : 'hover:bg-gray-50'} ${
                    isExcluded
                      ? 'opacity-60 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#f3f4f6_10px,#f3f4f6_20px)]'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                        isToday ? 'bg-blue-500 text-white' : ''
                      }`}
                    >
                      {item.day}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar">
                    {activeItems.map((type) => (
                      <div
                        key={type.id}
                        className={`flex items-center justify-between px-2 py-1 rounded text-xs font-medium ${type.color}`}
                      >
                        <span className="truncate pr-1">
                          {type.icon} {type.name}
                        </span>
                        <span className="bg-white/50 px-1.5 rounded-sm">{dayData[type.id]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full mt-6 bg-white p-6 rounded-2xl shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            {selectedDate ? `📅 ${selectedDate} 필요 장비 설정` : '수량을 입력할 날짜를 선택해주세요'}
          </h3>
          {selectedDate ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {itemTypes.map((type) => {
                  const currentValue = (events[selectedDate] && events[selectedDate][type.id]) || 0;
                  return (
                    <div
                      key={type.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 focus-within:border-blue-400 focus-within:bg-blue-50/30"
                    >
                      <label className="font-medium text-gray-700 flex items-center gap-2">
                        <span>{type.icon}</span> {type.name}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          className="w-20 text-right border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          value={currentValue === 0 ? '' : currentValue}
                          placeholder="0"
                          onChange={(e) => handleCalendarItemChange(type.id, e.target.value)}
                        />
                        <span className="text-gray-500 text-sm">대</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
                <span>💡</span>
                <p>
                  수량 입력 후 <strong>달력 칸을 클릭하고</strong> <kbd className="bg-white border px-1 rounded shadow-sm">Ctrl+C</kbd>{' '}
                  (복사) → 방향키 이동 후 <kbd className="bg-white border px-1 rounded shadow-sm">Ctrl+V</kbd>{' '}
                  (붙여넣기) 하세요.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 py-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              👆 달력에서 날짜를 선택하면 장비 수량을 입력할 수 있습니다.
            </p>
          )}
        </div>
      </>
    );
  };

  const renderSettingsMode = () => {
    return (
      <div className="bg-white rounded-b-2xl shadow-xl overflow-hidden border border-t-0 border-gray-200 p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2">⚙️ 단가 설정</h2>
          <p className="text-sm text-gray-500 mt-2">
            장비 단가를 수정하면 목록형/캘린더 계산 결과에 즉시 반영됩니다.
          </p>
        </div>

        <div className="space-y-5">
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60">
            <h3 className="font-bold text-lg text-gray-800 mb-3">🖨️ 흑백프린터</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm text-gray-700">
                <span className="font-medium">1~3일 기본 단가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.bw.upTo3}
                  onChange={(e) => handlePricingChange('bw', 'upTo3', e.target.value)}
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="font-medium">4~5일 기본 단가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.bw.day4to5}
                  onChange={(e) => handlePricingChange('bw', 'day4to5', e.target.value)}
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="font-medium">5일 초과 1일 추가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.bw.extraPerDay}
                  onChange={(e) => handlePricingChange('bw', 'extraPerDay', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60">
            <h3 className="font-bold text-lg text-gray-800 mb-3">🎨 컬러프린터</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm text-gray-700">
                <span className="font-medium">1~3일 기본 단가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.color.upTo3}
                  onChange={(e) => handlePricingChange('color', 'upTo3', e.target.value)}
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="font-medium">4~5일 기본 단가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.color.day4to5}
                  onChange={(e) => handlePricingChange('color', 'day4to5', e.target.value)}
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="font-medium">5일 초과 1일 추가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.color.extraPerDay}
                  onChange={(e) => handlePricingChange('color', 'extraPerDay', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60">
            <h3 className="font-bold text-lg text-gray-800 mb-3">📺 TV</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                <span className="font-medium">기본 단가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.tv.base}
                  onChange={(e) => handlePricingChange('tv', 'base', e.target.value)}
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="font-medium">1일 추가 단가</span>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={pricing.tv.extraPerDay}
                  onChange={(e) => handlePricingChange('tv', 'extraPerDay', e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4 font-sans text-gray-800">
      <div
        className={`fixed top-5 transition-opacity duration-300 z-50 ${
          toastMessage ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg font-medium">{toastMessage}</div>
      </div>

      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-t-2xl border-b border-gray-200 shadow-sm overflow-hidden flex flex-col sm:flex-row justify-between items-center px-2 pt-2">
          <div className="flex px-2 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => handleTabChange('list')}
              className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                viewMode === 'list'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              📝 기존 목록형 입력
            </button>
            <button
              onClick={() => handleTabChange('calendar')}
              className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                viewMode === 'calendar'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              📅 캘린더 입력
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                viewMode === 'settings'
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              ⚙️ 단가 설정
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 sm:py-0 w-full sm:w-auto justify-end border-t sm:border-t-0 border-gray-100">
            <span className="text-sm font-medium text-gray-600">주말 요금 적용</span>
            <button
              onClick={() => setIncludeWeekend(!includeWeekend)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                includeWeekend ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                  includeWeekend ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-bold w-12 ${includeWeekend ? 'text-blue-600' : 'text-gray-500'}`}>
              {includeWeekend ? '포함' : '미포함'}
            </span>
          </div>
        </div>

        {viewMode === 'calendar'
          ? renderCalendarMode()
          : viewMode === 'settings'
            ? renderSettingsMode()
            : renderListMode()}
      </div>

      <div className="w-full max-w-4xl mt-6 bg-white p-6 rounded-2xl shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">💰 총 예상 렌탈 비용</h3>
          <button
            onClick={handleCalculate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded-lg transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-lg"
          >
            계산하기
          </button>
        </div>

        {calcResult ? (
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-6 border-b border-gray-300 gap-4">
              <div className="text-gray-600">
                <span>
                  총 청구 일자: <strong className="text-gray-800 text-lg">{calcResult.activeDaysCount}일</strong>
                </span>
                <span className="text-sm ml-2 bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium">
                  (주말 {includeWeekend ? '포함' : '미포함'})
                </span>
              </div>
              <div className="text-right w-full md:w-auto">
                <span className="text-gray-500 mr-2 text-sm">총 합계</span>
                <span className="text-3xl font-bold text-blue-700">{calcResult.totalCost.toLocaleString()}원</span>
              </div>
            </div>

            {/* 결과 요약 (블록별 UI 출력) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {itemTypes.map((type) => {
                const detail = calcResult.details[type.id];
                if (detail.cost === 0) return null;
                return (
                  <div key={type.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="font-bold text-gray-700 flex items-center gap-1">
                        {type.icon} {type.name}
                      </span>
                      <button
                        onClick={() => removeItemEverywhere(type.id)}
                        className="text-[11px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 flex flex-col gap-1.5 break-keep">
                      {calcResult.blockStrsForUI[type.id].map((str, i) => (
                        <span
                          key={i}
                          className="bg-gray-100 px-2 py-1.5 rounded text-[11px] text-gray-700 font-medium"
                        >
                          {str}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 text-right">
                      <span className="font-bold text-gray-800 text-lg">{detail.cost.toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                  📋 견적서 비고란 복사용
                </label>
                <button
                  onClick={copyQuoteText}
                  className="text-xs bg-gray-800 hover:bg-gray-900 text-white py-1.5 px-3 rounded shadow-sm transition-colors"
                >
                  내용 복사하기
                </button>
              </div>
              <textarea
                readOnly
                className="w-full bg-white border border-gray-300 rounded-lg p-4 text-sm font-mono text-gray-700 h-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={calcResult.quoteText}
              />
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
            일정을 추가하고 <strong>[계산하기]</strong> 버튼을 누르면 정확한 복합 요금이 계산됩니다.
          </p>
        )}
      </div>
    </div>
  );
}

