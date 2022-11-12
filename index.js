const fs = require('fs-extra')
const path = require('path')
const { exec } = require('child_process')
const compressing = require('compressing')
const Oss = require('ali-oss')
const { argv } = require('optimist')

/** 从oss.js引入阿里云密钥配置 */
const { accessKeyId, accessKeySecret } = require('./oss.js')

/** 1. 根据命令行参数获取到本次打包部署的npm包工作目录 */
const target = path.resolve('../', argv.target)
const resolveTarget = file =>  path.join(target, file)
const packagePath = resolveTarget('package.json')

console.log('工作目录: ', target)

function build() {
  exec('npm run build', { cwd: target }, async function(err) {
    if(!!err) throw res.err
    const { name, version } = require(packagePath)
    const distPath = resolveTarget('dist')
    const destPath = resolveTarget(name)
    const tgzName = `${name}-${version}.tgz`
    const tgzPath = resolveTarget(tgzName)
    if(fs.statSync(destPath)) fs.removeSync(destPath)
    fs.renameSync(distPath, destPath)
    fs.copyFileSync(packagePath, resolveTarget(`${name}/package.json`))
    await compressing.tgz.compressDir(destPath, tgzPath)
    const client = createOss()
    await client.multipartUpload(`${name}/${tgzName}`, fs.readFileSync(tgzPath))
    console.log('打包部署完成')
  })
}

build()

/** 创建ali-oss连接实例 */
function createOss() {
  return new Oss({
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
    bucket: 'wuyou-npm',
    region: 'oss-cn-hangzhou'
  })
}