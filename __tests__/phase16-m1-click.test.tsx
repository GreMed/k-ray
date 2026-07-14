/**
 * K-Ray 第十六阶段封板修复：笔记 marker clickHandler 真实点击测试
 *
 * 覆盖：
 * - 点击笔记 marker 调用 onDateClick
 * - 笔记 marker 与关键节点 marker 同日共存且分别可点击
 * - 点击非 marker 普通日期也触发 onDateClick
 *
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';
import React from 'react';
import { render, act } from '@testing-library/react';
import type { KLineData, MarketKeyNode } from '@/types';

// === 顶层 mock：捕获 clickHandler 和 setMarkers ===
let clickHandlerRef: ((param: { hoveredObjectId?: string; time?: string }) => void) | null = null;
let setMarkersCall: { markers: unknown[] } | null = null;

jest.mock('lightweight-charts', () => {
  const originalModule = jest.requireActual('lightweight-charts');
  const mockCandlestickSeries = {
    setData: jest.fn(),
    setMarkers: jest.fn((markers: unknown[]) => {
      setMarkersCall = { markers };
    }),
    applyOptions: jest.fn(),
  };
  const mockChart = {
    addCandlestickSeries: jest.fn(() => mockCandlestickSeries),
    subscribeCrosshairMove: jest.fn(),
    subscribeClick: jest.fn((handler: (param: { hoveredObjectId?: string; time?: string }) => void) => {
      clickHandlerRef = handler;
    }),
    unsubscribeCrosshairMove: jest.fn(),
    unsubscribeClick: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: jest.fn(() => ({ fitContent: jest.fn() })),
    remove: jest.fn(),
  };
  return {
    ...originalModule,
    createChart: jest.fn(() => mockChart),
    CrosshairMode: { Normal: 0, Magnet: 1 },
  };
});

// 静态导入（使用顶层 mock）
import ProfessionalKLineChart from '@/components/ProfessionalKLineChart';

describe('第十六阶段封板修复：笔记 marker clickHandler 真实点击测试', () => {
  beforeEach(() => {
    clickHandlerRef = null;
    setMarkersCall = null;
  });

  afterEach(() => {
    // 清理 DOM
    document.body.innerHTML = '';
  });

  test('点击笔记 marker 调用 onDateClick 并打开对应日期笔记', async () => {
    const onDateClick = jest.fn();
    const testKlines: KLineData[] = [
      { id: 'k1', stockId: 's1', date: '2024-09-30', open: 100, high: 105, low: 98, close: 103, volume: 1000000, changePercent: 1.5 },
      { id: 'k2', stockId: 's1', date: '2024-10-08', open: 103, high: 108, low: 102, close: 107, volume: 1200000, changePercent: 3.9 },
    ];

    await act(async () => {
      render(
        <ProfessionalKLineChart
          klines={testKlines}
          noteMarkers={['2024-09-30']}
          stockCode="300750"
          onDateClick={onDateClick}
        />
      );
    });

    // 验证 marker 被创建
    expect(setMarkersCall).not.toBeNull();
    const markers = setMarkersCall!.markers as Array<{ id?: string; time: string }>;
    const noteMarker = markers.find(m => m.id?.startsWith('user-note:'));
    expect(noteMarker).toBeDefined();
    expect(noteMarker!.id).toBe('user-note:300750:2024-09-30');

    // 验证 clickHandler 被注册
    expect(clickHandlerRef).not.toBeNull();

    // 模拟点击笔记 marker
    await act(async () => {
      clickHandlerRef!({ hoveredObjectId: 'user-note:300750:2024-09-30' });
    });

    // 验证 onDateClick 被调用，且参数为对应日期
    expect(onDateClick).toHaveBeenCalledWith('2024-09-30');
  });

  test('笔记 marker 与关键节点 marker 同日共存且分别可点击', async () => {
    const onDateClick = jest.fn();
    const onMarketKeyNodeClick = jest.fn();
    const testKlines: KLineData[] = [
      { id: 'k1', stockId: 's1', date: '2024-09-30', open: 100, high: 105, low: 98, close: 103, volume: 1000000, changePercent: 1.5 },
    ];
    const testNode: MarketKeyNode = {
      id: 'significant_up:300750:2024-09-30',
      stockCode: '300750',
      date: '2024-09-30',
      type: 'significant_up' as const,
      title: '单日显著上涨',
      close: 103,
      changePercent: 1.5,
      volume: 1000000,
      previousClose: null,
      previousVolume: null,
      volumeChangePercent: null,
      detailSummary: '',
      evidenceLevel: 'market_data_only' as const,
    };

    await act(async () => {
      render(
        <ProfessionalKLineChart
          klines={testKlines}
          marketKeyNodes={[testNode]}
          noteMarkers={['2024-09-30']}
          stockCode="300750"
          onDateClick={onDateClick}
          onMarketKeyNodeClick={onMarketKeyNodeClick}
        />
      );
    });

    // 验证两个 marker 都存在
    const markers = setMarkersCall!.markers as Array<{ id?: string; time: string }>;
    const noteMarker = markers.find(m => m.id === 'user-note:300750:2024-09-30');
    const nodeMarker = markers.find(m => m.id === 'mkt-node:significant_up:300750:2024-09-30');
    expect(noteMarker).toBeDefined();
    expect(nodeMarker).toBeDefined();

    // 点击关键节点 marker
    await act(async () => {
      clickHandlerRef!({ hoveredObjectId: 'mkt-node:significant_up:300750:2024-09-30' });
    });
    expect(onMarketKeyNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'significant_up:300750:2024-09-30' }));
    expect(onDateClick).not.toHaveBeenCalled();

    // 点击笔记 marker
    await act(async () => {
      clickHandlerRef!({ hoveredObjectId: 'user-note:300750:2024-09-30' });
    });
    expect(onDateClick).toHaveBeenCalledWith('2024-09-30');
  });

  test('点击非 marker 普通日期也触发 onDateClick', async () => {
    const onDateClick = jest.fn();
    const testKlines: KLineData[] = [
      { id: 'k1', stockId: 's1', date: '2024-09-30', open: 100, high: 105, low: 98, close: 103, volume: 1000000, changePercent: 1.5 },
      { id: 'k2', stockId: 's1', date: '2024-10-08', open: 103, high: 108, low: 102, close: 107, volume: 1200000, changePercent: 3.9 },
    ];

    await act(async () => {
      render(
        <ProfessionalKLineChart
          klines={testKlines}
          stockCode="300750"
          onDateClick={onDateClick}
        />
      );
    });

    // 模拟点击普通日期（无 hoveredObjectId，但有 time）
    await act(async () => {
      clickHandlerRef!({ time: '2024-10-08' });
    });
    expect(onDateClick).toHaveBeenCalledWith('2024-10-08');
  });

  test('笔记 marker ID 格式为 user-note:<stockCode>:<date>', async () => {
    const testKlines: KLineData[] = [
      { id: 'k1', stockId: 's1', date: '2024-09-30', open: 100, high: 105, low: 98, close: 103, volume: 1000000, changePercent: 1.5 },
    ];

    await act(async () => {
      render(
        <ProfessionalKLineChart
          klines={testKlines}
          noteMarkers={['2024-09-30']}
          stockCode="600519"
        />
      );
    });

    const markers = setMarkersCall!.markers as Array<{ id?: string }>;
    const noteMarker = markers.find(m => m.id?.startsWith('user-note:'));
    expect(noteMarker).toBeDefined();
    expect(noteMarker!.id).toBe('user-note:600519:2024-09-30');
  });
});
