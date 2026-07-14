#!/usr/bin/env python3
"""
K-Ray BaoStock 股票基础资料查询客户端
查询证券简称等基础信息，用于替代静态名称映射

用法:
  baostock_stock_info.py <stockCode> <market>

输出:
  成功: stdout 输出 JSON {"success": true, "code": "...", "code_name": "...", ...}
  失败: stderr 输出 JSON {"success": false, "error": "..."}
"""
import sys
import json
import re


CODE_RE = re.compile(r'^\d{6}$')


def output_error(message):
    """输出结构化错误到 stderr 并退出"""
    result = {
        "success": False,
        "error": message,
    }
    print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
    sys.exit(1)


def code_to_baostock(code, market):
    """转换股票代码到 BaoStock 格式: 600519, SH -> sh.600519"""
    prefix = 'sh.' if market == 'SH' else 'sz.'
    return prefix + code


def fetch_stock_basic(bs_code):
    """
    查询股票基础资料
    返回字段: code, code_name, ipoDate, outDate, type, status
    """
    import baostock as bs

    # BaoStock 的 login/logout 会向 stdout 打印信息，污染 JSON 输出
    # 临时将 stdout 重定向到 stderr，保证 stdout 只有最终 JSON
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        lg = bs.login()
        if lg.error_code != '0':
            raise RuntimeError("BaoStock login failed")

        rs = bs.query_stock_basic(code=bs_code)
        if rs.error_code != '0':
            raise RuntimeError("BaoStock query_stock_basic failed: " + rs.error_msg)

        data_list = []
        while (rs.error_code == '0') & rs.next():
            data_list.append(rs.get_row_data())

        return data_list
    finally:
        try:
            bs.logout()
        except Exception:
            pass
        sys.stdout = real_stdout


def main():
    if len(sys.argv) < 3:
        output_error("参数不足。用法: baostock_stock_info.py <stockCode> <market>")

    stock_code = sys.argv[1]
    market = sys.argv[2]

    if not stock_code or not CODE_RE.match(stock_code):
        output_error("stockCode 必须为6位数字")
    if market not in ('SH', 'SZ'):
        output_error("market 只能为 SH 或 SZ")

    try:
        bs_code = code_to_baostock(stock_code, market)
        raw_rows = fetch_stock_basic(bs_code)

        if not raw_rows:
            result = {
                "success": True,
                "code": bs_code,
                "code_name": "",
                "ipoDate": "",
                "outDate": "",
                "type": "",
                "status": "",
                "found": False,
            }
            print(json.dumps(result, ensure_ascii=False))
            return

        row = raw_rows[0]
        # 字段顺序: code, code_name, ipoDate, outDate, type, status
        result = {
            "success": True,
            "code": row[0] if len(row) > 0 else bs_code,
            "code_name": row[1] if len(row) > 1 else "",
            "ipoDate": row[2] if len(row) > 2 else "",
            "outDate": row[3] if len(row) > 3 else "",
            "type": row[4] if len(row) > 4 else "",
            "status": row[5] if len(row) > 5 else "",
            "found": True,
        }
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        output_error(str(e))


if __name__ == '__main__':
    main()
