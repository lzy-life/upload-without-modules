# node-upload-demo
原生Node处理文件上传示例

### Node学习练手之作（没对文件进行功能拆分）
1. 路由处理
	> 根据路由响应不同操作
2. POST请求参数处理
	> POST请求的数据结构，详见[RFC1867](http://www.ietf.org/rfc/rfc1867.txt "RFC1867")

	> 获取上传的文件（二进制数据）处理
	
### 已有问题
1. 二进制数据处理有误差，导致合并之后写入的文件损坏
