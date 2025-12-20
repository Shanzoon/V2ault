// scripts/test-oss.js
require('dotenv').config(); // 读取 .env 文件
const OSS = require('ali-oss');
const path = require('path');

async function testUpload() {
  console.log('⏳ 正在连接阿里云 OSS...');

  // 1. 检查环境变量是否存在
  const requiredEnv = ['OSS_REGION', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET'];
  const missing = requiredEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ 错误: 缺少环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }

  try {
    // 2. 初始化 Client
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true, // 使用 HTTPS
    });

    // 3. 尝试上传一个简单的文本文件
    // 上传到 OSS 里的文件名叫 "test-connection.txt"
    // 内容是 "Hello V2ault! OSS is working."
    const result = await client.put('test-connection.txt', Buffer.from('Hello V2ault! OSS is working.'));

    console.log('✅ 连接成功！');
    console.log('📄 文件已上传:', result.name);
    console.log('🔗 返回 URL:', result.url);
    
    // 4. (可选) 尝试生成一个带签名的 URL 看看能不能访问
    const signedUrl = client.signatureUrl('test-connection.txt', { expires: 3600 });
    console.log('🔑 签名 URL (有效期1小时):', signedUrl);
    console.log('\n太棒了！请复制上面的签名 URL 在浏览器打开，如果能看到文字，说明配置完美！');

  } catch (err) {
    console.error('❌ 连接或上传失败:', err);
    console.error('请检查 ID, Secret, Bucket 名称或 Region 是否填写正确。');
  }
}

testUpload();