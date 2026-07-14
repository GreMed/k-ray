#!/usr/bin/env python3
"""
K-Ray BaoStock 历史日线行情客户端
仅用于实验性免费行情获取，不提供投资建议

用法:
  baostock_client.py <stockId> <stockCode> <market> <startDate> <endDate> [adjustflag]

输出:
  成功: stdout 输出 JSON {"success": true, "klines": [...], ...}
  失败: stderr 输出 JSON {"success": false, "error": "...", "klines": []}
"""
import sys
import json
import re
import datetime


DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
CODE_RE = re.compile(r'^\d{6}$')


def output_error(message):
    """输出结构化错误到 stderr 并退出"""
    result = {
        "success": False,
        "error": message,
        "klines": [],
        "count": 0,
    }
    print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
    sys.exit(1)


def validate_args(stock_id, stock_code, market, start_date, end_date, adjustflag):
    """校验所有参数"""
    if not stock_id:
        raise ValueError("stockId 不能为空")
    if not stock_code or not CODE_RE.match(stock_code):
        raise ValueError("stockCode 必须为6位数字")
    if market not in ('SH', 'SZ'):
        raise ValueError("market 只能为 SH 或 SZ")
    if not start_date or not DATE_RE.match(start_date):
        raise ValueError("startDate 必须为 YYYY-MM-DD 格式")
    if not end_date or not DATE_RE.match(end_date):
        raise ValueError("endDate 必须为 YYYY-MM-DD 格式")
    try:
        sd = datetime.date.fromisoformat(start_date)
        ed = datetime.date.fromisoformat(end_date)
    except ValueError:
        raise ValueError("日期格式非法")
    if sd > ed:
        raise ValueError("开始日期不能晚于结束日期")
    if adjustflag not in ('1', '2', '3'):
        raise ValueError("adjustflag 只能为 1/2/3")


def code_to_baostock(code, market):
    """转换股票代码到 BaoStock 格式: 600519, SH -> sh.600519"""
    prefix = 'sh.' if market == 'SH' else 'sz.'
    return prefix + code


def fetch_klines(bs_code, start_date, end_date, adjustflag='2'):
    """
    查询历史K线数据
    adjustflag: 1=后复权, 2=前复权, 3=不复权
    """
    import baostock as bs
    import sys

    # BaoStock 的 login/logout 会向 stdout 打印信息，污染 JSON 输出
    # 临时将 stdout 重定向到 stderr，保证 stdout 只有最终 JSON
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        lg = bs.login()
        if lg.error_code != '0':
            raise RuntimeError("BaoStock login failed")

        fields = "date,code,open,high,low,close,volume,amount,pctChg,tradestatus"
        rs = bs.query_history_k_data_plus(
            bs_code,
            fields,
            start_date=start_date,
            end_date=end_date,
            frequency='d',
            adjustflag=adjustflag,
        )

        if rs.error_code != '0':
            raise RuntimeError("BaoStock query failed")

        data_list = []
        while (rs.error_code == '0') & rs.next():
            data_list.append(rs.get_row_data())

        return data_list
    finally:
        # 保证 logout 执行
        try:
            bs.logout()
        except Exception:
            pass
        # 恢复 stdout
        sys.stdout = real_stdout


def parse_and_filter(raw_rows, stock_id):
    """解析并过滤数据，返回标准化K线列表"""
    seen_dates = set()
    klines = []

    for row in raw_rows:
        if len(row) < 10:
            continue

        date_str, code_str, open_str, high_str, low_str, close_str, \
            volume_str, amount_str, pct_chg_str, tradestatus_str = row[:10]

        # 过滤停牌数据
        if tradestatus_str != '1':
            continue

        if not date_str:
            continue

        # 去重
        if date_str in seen_dates:
            continue

        # 过滤非法数字
        try:
            open_p = float(open_str)
            high_p = float(high_str)
            low_p = float(low_str)
            close_p = float(close_str)
            volume = int(float(volume_str))
            pct_chg = float(pct_chg_str) if pct_chg_str else None
        except (ValueError, TypeError):
            continue

        # 过滤空OHLC
        if open_p <= 0 or high_p <= 0 or low_p <= 0 or close_p <= 0:
            continue

        seen_dates.add(date_str)

        kline = {
            "id": "baostock:{}:{}".format(stock_id, date_str),
            "stockId": stock_id,
            "date": date_str,
            "open": round(open_p, 2),
            "high": round(high_p, 2),
            "low": round(low_p, 2),
            "close": round(close_p, 2),
            "volume": volume,
            "changePercent": round(pct_chg, 2) if pct_chg is not None else None,
        }
        klines.append(kline)

    # 按日期升序
    klines.sort(key=lambda k: k["date"])
    return klines


def main():
    if len(sys.argv) < 6:
        output_error("参数不足。用法: baostock_client.py <stockId> <stockCode> <market> <startDate> <endDate> [adjustflag]")

    stock_id = sys.argv[1]
    stock_code = sys.argv[2]
    market = sys.argv[3]
    start_date = sys.argv[4]
    end_date = sys.argv[5]
    adjustflag = sys.argv[6] if len(sys.argv) > 6 else '2'

    try:
        validate_args(stock_id, stock_code, market, start_date, end_date, adjustflag)
    except ValueError as e:
        output_error(str(e))

    try:
        bs_code = code_to_baostock(stock_code, market)
        raw_rows = fetch_klines(bs_code, start_date, end_date, adjustflag)
        klines = parse_and_filter(raw_rows, stock_id)

        result = {
            "success": True,
            "klines": klines,
            "count": len(klines),
            "source": "baostock",
            "adjustment": "qfq" if adjustflag == '2' else ("hfq" if adjustflag == '1' else "none"),
        }
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        output_error(str(e))


if __name__ == '__main__':
    main()
