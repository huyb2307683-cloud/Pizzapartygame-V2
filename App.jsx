import React, { useState, useEffect, useRef } from 'react'; 
import { generateLevels } from './services/geminiService';

const PepperoniSet = () => (
  <>
    <div className="pepperoni" style={{ top: '20%', left: '30%' }}></div>
    <div className="pepperoni" style={{ top: '25%', left: '60%' }}></div>
    <div className="pepperoni" style={{ top: '50%', left: '20%' }}></div>
    <div className="pepperoni" style={{ top: '55%', left: '70%' }}></div>
    <div className="pepperoni" style={{ top: '70%', left: '45%' }}></div>
    <div className="pepperoni" style={{ top: '40%', left: '45%' }}></div>
  </>
);

const PizzaRender = ({ mask, isSlice }) => {
  return (
    <div 
      className={`pizza-body transition-all duration-300 ${isSlice ? 'hover:brightness-110 cursor-grab' : ''}`}
      style={{ 
        WebkitMaskImage: mask, maskImage: mask,
        width: '100%', height: '100%', background: '#ffa500', borderRadius: '50%', position: 'relative', overflow: 'hidden' 
      }}
    >
      <div className="pizza-cheese" style={{ position: 'absolute', inset: '10px', background: '#ffd700', borderRadius: '50%' }} />
      <PepperoniSet />
    </div>
  );
};

const App = () => {
  const [levels, setLevels] = useState([]);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [placedCakes, setPlacedCakes] = useState([]);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [answer, setAnswer] = useState({ mode: 'mixed', whole: '', numerator: '', denominator: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [knifePos, setKnifePos] = useState({ x: 0, y: 0, active: false });
  const [draggingId, setDraggingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [cutMenu, setCutMenu] = useState({ active: false, pizzaId: null, den: '' });

  // TRẠNG THÁI ĐIỂM SỐ
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [hasMistakeInLevel, setHasMistakeInLevel] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);

  const containerRef = useRef(null);
  const workspaceRef = useRef(null);
  const targetZoneRef = useRef(null);

  useEffect(() => {
    generateLevels().then(data => {
      if (data && data.length > 0) {
        setLevels(data);
        setIsLoading(false);
      }
    });
  }, []);

  const currentLevel = (levels && levels.length > 0) ? levels[currentLevelIdx] : null;

  const handlePointerMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingId) {
      setPlacedCakes(prev => prev.map(c => c.id === draggingId ? { ...c, x, y } : c));
      return; 
    }

    if (knifePos.active) {
      setKnifePos(prev => ({ ...prev, x, y }));
      let foundCutTarget = null;
      placedCakes.forEach(cake => {
        if (!cake.isSlice) {
          const dist = Math.hypot(x - cake.x, y - cake.y);
          if (dist >= 0 && dist <= 100) foundCutTarget = cake.id;
        }
      });
      if (foundCutTarget && foundCutTarget !== cutMenu.pizzaId) {
        setCutMenu({ active: true, pizzaId: foundCutTarget, den: '' });
      }
    }
  };

  const handlePointerUp = (e) => {
    if (draggingId) setDraggingId(null);
    if (!cutMenu.active) setKnifePos(prev => ({ ...prev, active: false }));
  };

  const handleNewPizzaStart = (e) => { e.dataTransfer.setData('type', 'new-pizza'); };

  const handleWorkspaceDrop = (e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (e.dataTransfer.getData('type') === 'new-pizza') {
      const newId = Math.random().toString(36).substr(2, 9);
      setPlacedCakes([...placedCakes, { id: newId, x, y, isCut: false, slices: 1, isSlice: false }]);
    }
  };

  // NÂNG CẤP 1: LÁT CẮT TỰ ĐỘNG TÁCH RỜI
  const executeCut = () => {
    if (!cutMenu.pizzaId) return;
    const targetCake = placedCakes.find(c => c.id === cutMenu.pizzaId);
    if (!targetCake) return;
    const numSlices = parseInt(cutMenu.den);
    if (isNaN(numSlices) || numSlices <= 1) return;

    const sliceAngle = 360 / numSlices;
    const separationDistance = 25; // Khoảng cách các lát tách ra khỏi tâm

    const newSlices = Array.from({ length: numSlices }).map((_, i) => {
      const startAngle = sliceAngle * i;
      const midAngle = startAngle + sliceAngle / 2;
      const rad = (midAngle - 90) * (Math.PI / 180);
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        // Tính toán tọa độ tách rời dựa trên góc của lát cắt
        x: targetCake.x + Math.cos(rad) * separationDistance,
        y: targetCake.y + Math.sin(rad) * separationDistance,
        isCut: true,
        slices: numSlices,
        startAngle: startAngle,
        isSlice: true
      };
    });

    setPlacedCakes(prev => [...prev.filter(c => c.id !== cutMenu.pizzaId), ...newSlices]);
    setCutMenu({ active: false, pizzaId: null, den: '' });
    setKnifePos(prev => ({ ...prev, active: false }));
  };

  const checkNumericalAnswer = () => {
    if (!currentLevel) return;
    const isCorrect = parseInt(answer.whole || '0') === currentLevel.correctWhole &&
                      parseInt(answer.numerator || '0') === currentLevel.correctNumerator &&
                      parseInt(answer.denominator || '0') === currentLevel.correctDenominator;
    
    setFeedback(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      // Nếu không có lỗi nào trước đó trong màn này, tính là 1 câu đúng
      if (!hasMistakeInLevel) {
        setStats(prev => ({ ...prev, correct: prev.correct + 1 }));
      } else {
        setStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      }

      setTimeout(() => {
        setFeedback(null); 
        setIsInputOpen(false);
        setHasMistakeInLevel(false); // Reset lỗi cho màn mới

        if (currentLevelIdx < levels.length - 1) {
          setCurrentLevelIdx(currentLevelIdx + 1);
          setPlacedCakes([]);
          setAnswer({ mode: 'mixed', whole: '', numerator: '', denominator: '' });
        } else {
          setIsGameFinished(true); // KÍCH HOẠT MÀN HÌNH ĐIỂM
        }
      }, 2000);
    } else {
      setHasMistakeInLevel(true); // Ghi nhận có lỗi trong màn chơi hiện tại
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center text-5xl agbalumo animate-pulse">🍕 Đang chuẩn bị bàn tiệc...</div>;

  // NÂNG CẤP 2: GIAO DIỆN MÀN HÌNH TỔNG KẾT
  if (isGameFinished) {
    return (
      <div className="h-screen w-screen bg-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-[60px] shadow-2xl border-8 border-rose-400 p-12 max-w-2xl w-full text-center agbalumo">
          <h1 className="text-6xl text-rose-600 mb-8">🎉 KẾT QUẢ 🎉</h1>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-green-50 p-8 rounded-[40px] border-4 border-green-200">
              <p className="text-2xl text-green-700 mb-2 uppercase">Câu Đúng</p>
              <p className="text-7xl text-green-600">{stats.correct}</p>
            </div>
            <div className="bg-red-50 p-8 rounded-[40px] border-4 border-red-200">
              <p className="text-2xl text-red-700 mb-2 uppercase">Câu Sai</p>
              <p className="text-7xl text-red-600">{stats.wrong}</p>
            </div>
          </div>
          <div className="bg-rose-500 text-white p-6 rounded-[30px] mb-10 shadow-lg">
            <p className="text-4xl">Tổng Điểm: {stats.correct}/10</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-rose-600 text-white px-12 py-6 rounded-full text-3xl hover:scale-105 transition-transform shadow-xl"
          >
            Chơi Lại Từ Đầu 🔄
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="game-container agbalumo select-none relative overflow-hidden h-screen w-screen" style={{ touchAction: 'none' }} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {/* Header, Workspace, Tools... (Giữ nguyên phần render cũ đã tối ưu ở các bước trước) */}
      <div className="bg-white/95 p-6 border-b-4 border-rose-300 flex items-center justify-center text-center z-20 shadow-md">
        <p className="text-2xl md:text-3xl lg:text-4xl text-rose-900 leading-tight">
          <span className="text-rose-500 mr-2">Màn {currentLevelIdx + 1}:</span> {currentLevel?.problem}
        </p>
      </div>

      <div ref={workspaceRef} className="workspace" onDragOver={(e) => e.preventDefault()} onDrop={handleWorkspaceDrop}>
        {/* Đĩa đáp án */}
        <div ref={targetZoneRef} className="absolute right-10 top-1/2 -translate-y-1/2 w-[320px] h-[460px] border-4 border-dashed border-rose-300 bg-rose-50/30 rounded-[60px] flex flex-col items-center p-8 pointer-events-none">
          <div className="bg-rose-500 text-white text-[16px] px-5 py-2 rounded-full mb-6 font-bold uppercase">Vùng đáp án</div>
          <div className="flex-1 w-full border-8 border-white rounded-full bg-slate-100/50 shadow-inner flex items-center justify-center text-8xl opacity-10">🍽️</div>
        </div>

        {/* Render Bánh Pizza */}
        {placedCakes.map(cake => (
          <div key={cake.id} className="pizza-placed"
            style={{ left: cake.x - 90, top: cake.y - 90, width: 180, height: 180, zIndex: draggingId === cake.id ? 100 : 5, touchAction: 'none' }}
            onPointerDown={(e) => { if (!knifePos.active) { e.currentTarget.setPointerCapture(e.pointerId); setDraggingId(cake.id); setCutMenu({ active: false, pizzaId: null, den: '' }); } }}
          >
            <div className="pizza-content">
              {!cake.isSlice ? <PizzaRender /> : <PizzaRender isSlice mask={`conic-gradient(from ${cake.startAngle}deg, black ${360/cake.slices}deg, transparent 0deg)`} />}
            </div>
          </div>
        ))}

        {/* Hiển thị con dao */}
        {knifePos.active && (
          <div className="absolute pointer-events-none text-7xl z-[180] transition-transform duration-75" style={{ left: knifePos.x, top: knifePos.y, transform: 'translate(-50%, -50%) rotate(-45deg)' }}>🔪</div>
        )}

        {/* Bảng cắt bánh */}
        {cutMenu.active && (
          <div className="absolute z-[120] bg-white p-8 rounded-[50px] shadow-2xl border-4 border-rose-500 flex flex-col items-center justify-center gap-6 min-w-[300px]"
            style={{ left: placedCakes.find(c => c.id === cutMenu.pizzaId)?.x + 110, top: placedCakes.find(c => c.id === cutMenu.pizzaId)?.y - 140 }}>
            <p className="text-rose-900 text-xl font-bold text-center leading-snug">Bạn muốn cắt chiếc bánh thành mấy phần?</p>
            <input type="number" autoFocus placeholder="?" value={cutMenu.den} onChange={(e) => setCutMenu({ ...cutMenu, den: e.target.value })}
                className="w-24 h-20 border-4 border-rose-400 rounded-2xl text-center text-4xl outline-none" />
            <div className="flex gap-4 w-full">
              <button onClick={() => { setCutMenu({ active: false, pizzaId: null, den: '' }); setKnifePos({ ...knifePos, active: false }); }} className="flex-1 bg-slate-100 p-4 rounded-2xl font-bold text-slate-500">HỦY</button>
              <button onClick={executeCut} className="flex-1 bg-rose-500 text-white p-4 rounded-2xl font-bold shadow-lg">CẮT</button>
            </div>
          </div>
        )}

        <button onClick={() => {
            const targetZone = targetZoneRef.current?.getBoundingClientRect();
            const containerRect = containerRef.current?.getBoundingClientRect();
            const cakesInZone = placedCakes.filter(cake => cake.x > (targetZone.left - containerRect.left) && cake.x < (targetZone.right - containerRect.left) && cake.y > (targetZone.top - containerRect.top) && cake.y < (targetZone.bottom - containerRect.top));
            const totalValueInZone = cakesInZone.reduce((acc, cake) => acc + (cake.isSlice ? (1 / cake.slices) : 1.0), 0);
            const expectedValue = currentLevel.totalCakes / currentLevel.shareWith;
            if (Math.abs(totalValueInZone - expectedValue) > 0.001) { alert("Số lượng bánh trong đĩa chưa đúng!"); return; }
            setIsInputOpen(true);
        }} className="btn-done text-4xl py-6 px-16">XÁC NHẬN</button>
      </div>

      {/* Toolbar & Popups */}
      <div className="bottom-tools">
        <div className="flex flex-col items-center p-4 border-r-4 border-rose-100">
          <p className="mb-2 text-xl text-rose-800 font-bold">🍕 Lấy Bánh</p>
          <div draggable onDragStart={handleNewPizzaStart} className="w-20 h-20 bg-amber-500 rounded-full border-4 border-amber-800 shadow-lg cursor-grab active:scale-95" />
        </div>
        <div className="flex flex-col items-center p-4">
          <p className="mb-2 text-xl text-rose-800 font-bold">🔪 Dùng Dao</p>
          <div onPointerDown={(e) => { const rect = containerRef.current.getBoundingClientRect(); setKnifePos({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true }); }}
            className={`w-20 h-20 bg-white border-4 rounded-full flex items-center justify-center text-5xl shadow-xl active:scale-95 ${knifePos.active ? 'border-rose-600 bg-rose-100' : 'border-rose-300'}`}>🔪</div>
        </div>
      </div>

      {isInputOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center backdrop-blur-sm bg-black/20">
          <div className="input-popup w-[500px] p-12 flex flex-col items-center">
            <h2 className="text-3xl mb-8 text-rose-900 font-bold">Mỗi người nhận được?</h2>
            <div className="flex items-center gap-6 mb-10">
              <input className="w-20 h-28 border-4 border-black rounded-2xl text-center text-5xl outline-none" type="number" value={answer.whole} onChange={(e) => setAnswer({ ...answer, whole: e.target.value })} />
              <div className="flex flex-col items-center gap-2">
                <input className="w-16 h-16 border-4 border-black rounded-xl text-center text-2xl" type="number" value={answer.numerator} onChange={(e) => setAnswer({ ...answer, numerator: e.target.value })} />
                <div className="w-20 h-1.5 bg-black rounded-full" />
                <input className="w-16 h-16 border-4 border-black rounded-xl text-center text-2xl" type="number" value={answer.denominator} onChange={(e) => setAnswer({ ...answer, denominator: e.target.value })} />
              </div>
            </div>
            <button onClick={checkNumericalAnswer} className="w-full bg-rose-600 text-white text-3xl py-5 rounded-[30px] shadow-xl">KIỂM TRA</button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
          <div className={`p-16 rounded-[60px] bg-white shadow-2xl border-8 ${feedback === 'correct' ? 'border-green-500' : 'border-red-500'}`}>
             <div className="text-9xl">{feedback === 'correct' ? '✅' : '❌'}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;