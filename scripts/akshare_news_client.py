#!/usr/bin/env python3
"""
K-Ray AKShare 新闻数据客户端（第十阶段 A）
使用 AKShare 的 stock_news_em 接口获取个股新闻候选数据。
仅用于实验性数据源可行性验证，不代表正式商业数据源。

用法:
  akshare_news_client.py <stockCode>

输出:
  成功: stdout 输出 JSON {"success": true, "news": [...], "count": N, ...}
  失败: stderr 输出 JSON {"success": false, "error": "...", "news": []}

注意:
  - AKShare 是数据获取工具，东方财富是上游平台
  - 不抓取新闻全文，只返回接口直接提供的短内容
  - 不保存任何数据到本地文件
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
        "news": [],
        "count": 0,
    }
    print(json.dumps(result, ensure_ascii=False), file=sys.stderr)
    sys.exit(1)


def validate_args(stock_code):
    """校验参数"""
    if not stock_code or not CODE_RE.match(stock_code):
        raise ValueError("stockCode 必须为6位数字")


def fetch_news(stock_code):
    """
    调用 AKShare stock_news_em 获取新闻
    返回原始 DataFrame
    """
    import akshare as ak

    # stock_news_em 会在某些情况下向 stdout 打印信息
    # 临时将 stdout 重定向到 stderr，保证 stdout 只有最终 JSON
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        df = ak.stock_news_em(symbol=stock_code)
        return df
    finally:
        sys.stdout = real_stdout


def parse_news(df, stock_code):
    """
    将 DataFrame 转换为标准化新闻列表
    只提取接口直接返回的字段，不自行生成内容
    """
    news_list = []

    # AKShare stock_news_em 返回列名（中文）:
    # 关键词, 新闻标题, 新闻内容, 发布时间, 文章来源, 新闻链接
    for _, row in df.iterrows():
        title = str(row.get('新闻标题', '')).strip()
        content = str(row.get('新闻内容', '')).strip()
        publish_time = str(row.get('发布时间', '')).strip()
        source = str(row.get('文章来源', '')).strip()
        url = str(row.get('新闻链接', '')).strip()

        # 跳过空标题
        if not title:
            continue

        news_item = {
            "title": title,
            "content": content,
            "publishTime": publish_time,
            "source": source,
            "url": url,
        }
        news_list.append(news_item)

    return news_list


def main():
    if len(sys.argv) < 2:
        output_error("参数不足。用法: akshare_news_client.py <stockCode>")

    stock_code = sys.argv[1]

    try:
        validate_args(stock_code)
    except ValueError as e:
        output_error(str(e))

    try:
        df = fetch_news(stock_code)
        news_list = parse_news(df, stock_code)

        result = {
            "success": True,
            "news": news_list,
            "count": len(news_list),
            "stockCode": stock_code,
            "source": "akshare",
            "upstreamPlatform": "eastmoney",
        }
        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        output_error(str(e))


if __name__ == '__main__':
    main()
