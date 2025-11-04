addEventListener('fetch', event => {
  event.respondWith(handleVlessSubscription(event.request))
})

// 1. 5个VLESS节点源网址（均含B64编码内容）
const VLESS_SOURCES = [
  "https://sub.cmliussss.net/sub?uuid=f934df12-b33a-43cc-9382-9444e80d3124&path=%2Fip%3Dproxyip.fxxk.dedyn.io&security=tls&encryption=none&host=dl.ouuuo.ggff.net&type=ws&sni=dl.ouuuo.ggff.net",
  "https://zrf.zrf.me/sub?uuid=f934df12-b33a-43cc-9382-9444e80d3124&path=%2Fip%3Dproxyip.fxxk.dedyn.io&security=tls&encryption=none&host=dl.ouuuo.ggff.net&type=ws&sni=dl.ouuuo.ggff.net",
  "https://owo.o00o.ooo/sub?uuid=f934df12-b33a-43cc-9382-9444e80d3124&encryption=none&security=tls&sni=dl.ouuuo.ggff.net&alpn=&fp=random&type=ws&host=dl.ouuuo.ggff.net&path=%2Fip%3Dproxyip.fxxk.dedyn.io&fragment=1%2C40-60%2C30-50%2Ctlshello",
  "https://cfsub.cfcdn.xx.kg/sub?uuid=f934df12-b33a-43cc-9382-9444e80d3124&encryption=none&security=tls&sni=dl.ouuuo.ggff.net&alpn=&fp=random&type=ws&host=dl.ouuuo.ggff.net&path=%2Fip%3Dproxyip.fxxk.dedyn.io&fragment=1%2C40-60%2C30-50%2Ctlshello",
  "https://sub.lzjbaby.com/sub?uuid=f934df12-b33a-43cc-9382-9444e80d3124&encryption=none&security=tls&sni=dl.ouuuo.ggff.net&alpn=&fp=random&type=ws&host=dl.ouuuo.ggff.net&path=%2Fip%3Dproxyip.fxxk.dedyn.io&fragment=1%2C40-60%2C30-50%2Ctlshello"
]

// 2. 10项内容替换规则（确保节点备注正确）
const REPLACE_CONFIG = {
  "【TG:@LSMOO】": "·TG@pikpak18x",
  "TG@LSMOO": "·TG@pikpak18x·",
  "秋名山优选": "18x优选",
  "CF182682": "18x优选",
  "青云志优选": "18x优选",
  "CM优选": "18x优选",
  "t.me/CMLiussss": "t.me/pikpak18x",
  "Tg里的欢乐时光": "PIKPAK🔞资源社",
  "群组@mianfeicf": "TG频道@pikpak18x",
  "TG@lzjjjjjjjjjjj": "TG@pikpak18x",
  "辣子鸡": " ",
  "Join.my.Telegram.channel.CMLiussss.to.unlock.more.premium.nodes.cf.090227.xyz": "dl.ouuuo.ggff.net",
  "blog.notett.com": "TG@pikpak18x"
}

// 辅助1：验证Vless节点格式（确保订阅有效性）
function isVlessValid(vlessUrl) {
  const vlessRegex = /^vless:\/\/[0-9a-fA-F-]{36}@[\d\.a-zA-Z]+:\d+\?.*$/
  return vlessRegex.test(vlessUrl.trim())
}

// 辅助2：UTF-8安全的Base64编码（适配代理工具解析）
function utf8ToBase64(str) {
  const encoder = new TextEncoder()
  const uint8Array = encoder.encode(str)
  return btoa(String.fromCharCode(...uint8Array))
}

async function handleVlessSubscription(request) {
  try {
    let allVlessNodes = []
    // 1. 批量抓取+解码源内容
    for (const sourceUrl of VLESS_SOURCES) {
      try {
        const response = await fetch(sourceUrl, {
          headers: { "User-Agent": "VLESS-Subscription/Cloudflare-Workers" },
          cf: { cacheTtl: 600 }, // 10分钟缓存，平衡实时性与性能
          timeout: 12000
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        // 源内容解码：B64（清理空白）→ URL
        let encodedContent = await response.text()
        const cleanB64 = encodedContent.replace(/\s+/g, '')
        let decodedContent = atob(cleanB64)
        decodedContent = decodeURIComponent(decodedContent)

        // 提取标准Vless节点
        const lines = decodedContent.split(/[\n\r]+/)
        const validVless = lines
          .map(line => line.trim())
          .filter(line => line.startsWith("vless://") && isVlessValid(line))
        allVlessNodes.push(...validVless)

      } catch (err) {
        console.warn(`[${sourceUrl}] 处理失败: ${err.message}`)
        continue
      }
    }

    // 2. 节点去重→内容替换（确保无重复且备注正确）
    const uniqueVlessNodes = [...new Set(allVlessNodes)]
    const finalNodes = uniqueVlessNodes.map(node => {
      let modifiedNode = node
      Object.entries(REPLACE_CONFIG).forEach(([oldStr, newStr]) => {
        modifiedNode = modifiedNode.replace(oldStr, newStr)
      })
      return modifiedNode
    })

    // 3. 生成代理工具兼容的订阅格式
    const subscriptionText = finalNodes.join('\n') // 一行一个节点（标准订阅格式）
    const b64Subscription = utf8ToBase64(subscriptionText) // Base64编码（代理工具默认解析格式）

    // 4. 响应头适配：模拟标准订阅链接，确保工具识别
    return new Response(b64Subscription, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8", // 代理工具通用MIME类型
        "Access-Control-Allow-Origin": "*", // 解决跨域请求问题
        "Cache-Control": "public, max-age=600", // 控制缓存更新频率
        "Content-Disposition": 'inline; filename="vless-subscription.txt"', // 可选：下载时的默认文件名
        "X-Subscription-Type": "VLESS", // 标识订阅类型，部分工具依赖
        "X-Node-Count": finalNodes.length // 节点数量标识（可选）
      }
    })

  } catch (globalErr) {
    // 错误处理：返回明确提示，便于排查
    return new Response(`订阅生成失败: ${globalErr.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  }
}
