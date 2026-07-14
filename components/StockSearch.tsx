'use client';

import { useState, useRef, useEffect } from 'react';
import { Stock } from '@/types';
import { mockStocks } from '@/data/mockData';
import { buildStockFromCode, detectMarket, formatStockLabel } from '@/utils/stockCode';

interface StockSearchProps {
  onSelectStock: (stock: Stock | null) => void;
  selectedStock: Stock | null;
}

export default function StockSearch({ onSelectStock, selectedStock }: StockSearchProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  // 自定义代码的实时名称查询状态
  const [customCodeName, setCustomCodeName] = useState<string>('');
  const [customCodeLoading, setCustomCodeLoading] = useState(false);
  // 跟踪当前查询的代码，避免过期请求覆盖新结果
  const queryCodeRef = useRef<string>('');
  // 跟踪最新的 selectedStock，供异步回调读取最新值
  const selectedStockRef = useRef<Stock | null>(selectedStock);
  useEffect(() => {
    selectedStockRef.current = selectedStock;
  }, [selectedStock]);

  const filteredStocks = mockStocks.filter(stock =>
    stock.code.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  // 判断当前输入是否为可识别的6位A股代码
  const typedCode = searchKeyword.trim();
  const detectedMarket = detectMarket(typedCode);
  // 如果代码已匹配预设股票，不再显示自定义代码选项
  const isPresetMatch = filteredStocks.some(s => s.code === typedCode);
  const isCustomCode = /^\d{6}$/.test(typedCode) && detectedMarket !== null && !isPresetMatch;
  const isUnknownCode = /^\d{6}$/.test(typedCode) && detectedMarket === null;

  // 异步查询股票真实名称
  const queryStockName = async (code: string, market: 'SH' | 'SZ') => {
    queryCodeRef.current = code;
    setCustomCodeLoading(true);
    setCustomCodeName('');
    try {
      const params = new URLSearchParams({ stockCode: code, market });
      const res = await fetch(`/api/market/stock-info?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      // 检查是否为最新查询（避免过期请求覆盖）
      if (queryCodeRef.current !== code) return;
      const resolvedName = data.name || '';
      setCustomCodeName(resolvedName);
      // 名称晚到自动同步：如果用户已选中该代码且名称为空，自动补全
      const current = selectedStockRef.current;
      if (current && current.code === code && !current.name && resolvedName) {
        onSelectStock({ ...current, name: resolvedName });
      }
    } catch {
      // 查询失败，name 保持空字符串
    } finally {
      if (queryCodeRef.current === code) {
        setCustomCodeLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);
    setShowSuggestions(true);
    setInputError(null);

    // 实时校验6位数字代码
    const code = value.trim();
    if (code.length > 0 && /^\d+$/.test(code) && code.length < 6) {
      setInputError(null); // 还在输入中，不报错
    } else if (code.length === 6 && detectMarket(code) === null) {
      setInputError(`无法识别该股票代码的市场，暂不支持`);
    } else if (code.length > 0 && code.length > 6 && /^\d+$/.test(code)) {
      setInputError('股票代码应为6位数字');
    } else if (code.length > 0 && !/^\d+$/.test(code) && !mockStocks.some(s => s.name.includes(code) || s.code.includes(code))) {
      // 非数字输入且不匹配预设股票名称
      if (code.length >= 2) {
        setInputError(null); // 可能是名称搜索
      }
    }

    // 输入合法 6 位代码时，异步查询真实名称
    if (code.length === 6) {
      const market = detectMarket(code);
      if (market && !mockStocks.some(s => s.code === code)) {
        queryStockName(code, market);
      }
    } else {
      setCustomCodeName('');
      setCustomCodeLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmCode();
    }
  };

  const handleConfirmCode = async () => {
    const code = searchKeyword.trim();

    if (!code) {
      setInputError('请输入股票代码');
      return;
    }

    // 尝试作为股票代码识别
    if (/^\d{6}$/.test(code)) {
      const stock = buildStockFromCode(code);
      if (stock) {
        // 合并已查询到的名称
        if (customCodeName) {
          stock.name = customCodeName;
        }
        onSelectStock(stock);
        setSearchKeyword('');
        setShowSuggestions(false);
        setInputError(null);
        return;
      } else {
        setInputError('无法识别该股票代码的市场，暂不支持');
        return;
      }
    }

    // 非数字：如果有匹配的预设股票，选第一个
    if (filteredStocks.length > 0) {
      handleSelectStock(filteredStocks[0]);
      return;
    }

    setInputError('请输入 6 位沪深上市A股代码（如 600519），按回车查询');
  };

  const handleSelectStock = (stock: Stock) => {
    onSelectStock(stock);
    setSearchKeyword('');
    setShowSuggestions(false);
    setInputError(null);
  };

  const handleClearStock = () => {
    onSelectStock(null);
    setSearchKeyword('');
    setInputError(null);
  };

  const handleFocus = () => {
    if (searchKeyword) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  // 自定义代码选项中显示的名称文本
  const customCodeDisplay = customCodeLoading
    ? '查询名称中...'
    : (customCodeName || '名称暂未取得');

  return (
    <div className="relative w-full md:w-1/2">
      <label className="block text-sm font-semibold text-ink mb-2">
        股票代码
      </label>
      <div className="relative">
        <input
          type="text"
          value={selectedStock ? formatStockLabel(selectedStock) : searchKeyword}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="输入 6 位沪深上市A股代码（如 600519），按回车查询"
          className="w-full h-[42px] px-4 border border-line rounded-lg bg-white text-ink font-semibold outline-none focus:border-blue focus:ring-1 focus:ring-blue transition-all"
          disabled={!!selectedStock}
          data-testid="stock-search-input"
        />

        {/* 下拉建议列表 */}
        {showSuggestions && !selectedStock && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg z-10 max-h-[240px] overflow-y-auto">
            {/* 自定义代码选项 */}
            {isCustomCode && (
              <button
                onClick={() => handleConfirmCode()}
                className="w-full px-4 py-3 text-left hover:bg-paper transition-colors border-b border-line bg-blue/5"
                data-testid="custom-code-option"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink">{typedCode}</span>
                  <span className="text-xs text-blue bg-blue/10 px-2 py-1 rounded font-semibold">{detectedMarket}</span>
                  <span className="text-muted text-xs">
                    {customCodeDisplay}
                  </span>
                  <span className="ml-auto text-xs text-blue font-semibold">点击查询 ↵</span>
                </div>
              </button>
            )}

            {/* 预设股票建议 */}
            {filteredStocks.map(stock => (
              <button
                key={stock.id}
                onClick={() => handleSelectStock(stock)}
                className="w-full px-4 py-3 text-left hover:bg-paper transition-colors border-b border-line last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink">{stock.code}</span>
                  <span className="text-muted">{stock.name}</span>
                  <span className="text-xs text-muted bg-paper px-2 py-1 rounded">{stock.market}</span>
                </div>
              </button>
            ))}

            {/* 无匹配且非代码 */}
            {filteredStocks.length === 0 && !isCustomCode && !isUnknownCode && searchKeyword.trim() && (
              <div className="px-4 py-3 text-sm text-muted">
                请输入 6 位沪深上市A股代码（如 600519、000001、300750、688981、301165），按回车查询
              </div>
            )}

            {/* 无法识别的6位代码 */}
            {isUnknownCode && (
              <div className="px-4 py-3 text-sm text-red">
                无法识别代码 {typedCode} 的市场，目前仅支持沪深A股
              </div>
            )}
          </div>
        )}
      </div>

      {/* 输入错误提示 */}
      {inputError && !selectedStock && (
        <p className="mt-1.5 text-xs text-red font-semibold" data-testid="stock-search-error">
          {inputError}
        </p>
      )}

      {/* 已选股票标签 */}
      {selectedStock && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted bg-blue/10 px-2 py-1 rounded border border-blue/20">
            已选择: {formatStockLabel(selectedStock)} ({selectedStock.market})
          </span>
          <button
            onClick={handleClearStock}
            className="text-xs text-red hover:underline"
          >
            清除
          </button>
        </div>
      )}
    </div>
  );
}
