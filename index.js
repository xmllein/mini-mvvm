;(function () {
  // 初始化类
  class MiniVue {
    constructor(options) {
      // 获取元素和data数据
      this.$el = options.el
      this.$data = options.data

      // 判断是否有el元素
      if (this.$el) {
        // 数据劫持
        new Observer(this.$data)

        // 编译模板
        new TemplateCompile(this.$el, this)
      }
    }
  }

  // 模板编译类
  class TemplateCompile {
    constructor(el, vm) {
      // 判断el是否是元素，如果不是元素，就获取元素
      this.el = el.nodeType === 1 ? el : document.querySelector(el)
      // 获取vm
      this.vm = vm

      // 如果元素存在，就开始编译
      if (this.el) {
        //  1，把dom元素转换成文档碎片对象，放入内存中，减少页面的回流和重绘
        let fragment = this.nodeToFragment(this.el)

        // 2，编译模板(语法解析)
        this.compile(fragment)

        // 3，把编译好的文档碎片对象，添加到页面中
        this.el.appendChild(fragment)
      }
    }

    // 将dom元素转换成文档碎片对象
    nodeToFragment(el) {
      let fragment = document.createDocumentFragment()
      let firstChild = null
      // 循环遍历el中的子元素，将子元素添加到文档碎片中
      while ((firstChild = el.firstChild)) {
        fragment.appendChild(firstChild)
      }
      return fragment
    }

    // 编译模板
    compile(fragment) {
      // 获取文档碎片中的子节点
      let childNodes = fragment.childNodes
      // 循环遍历子节点
      childNodes.forEach((node) => {
        // 判断节点类型
        if (this.isElementNode(node)) {
          // 如果是元素节点，就编译元素节点
          this.compileElement(node)
        } else if (this.isTextNode(node)) {
          // 如果是文本节点，就编译文本节点
          this.compileText(node)
        }

        // 如果当前节点还有子节点，就递归调用compile方法
        if (node.childNodes && node.childNodes.length) {
          this.compile(node)
        }
      })
    }

    // 元素节点
    isElementNode(node) {
      return node.nodeType === 1
    }

    // 文本节点
    isTextNode(node) {
      return node.nodeType === 3
    }

    // 判断属性名是否是指令
    isDirective(attrName) {
      return attrName.startsWith('v-')
    }

    // 编译文本节点
    compileText(node) {
      // 获取文本节点中的内容
      let content = node.textContent
      // 判断文本节点中是否有{{}}
      if (/\{\{(.+?)\}\}/.test(content)) {
        // 调用工具方法，解析文本节点中的内容
        CompileTool['text'](node, content, this.vm)
      }
    }

    // 编译元素节点
    compileElement(node) {
      // 获取元素节点中的所有属性
      let attributes = node.attributes
      // 循环遍历元素节点中的属性
      Array.from(attributes).forEach((attr) => {
        // 获取属性名
        let attrName = attr.name
        // 判断属性名是否是指令
        if (this.isDirective(attrName)) {
          // 获取属性值
          let expr = attr.value
          // 获取指令名
          let type = attrName.slice(2)
          // 调用工具方法，解析元素节点中的指令
          CompileTool[type](node, expr, this.vm)
        }
      })
    }
  }

  // 数据劫持类（响应式）
  class Observer {
    constructor(data) {
      // 获取data
      this.data = data
      // 开始劫持数据
      this.walk(data)
    }

    // 开始劫持数据
    walk(data) {
      // 判断data是否是对象
      if (data && typeof data === 'object') {
        // 循环遍历data中的属性
        Object.keys(data).forEach((key) => {
          // 劫持数据
          this.defineReactive(data, key, data[key])
        })
      }
    }

    // 劫持数据
    defineReactive(obj, key, value) {
      // 递归遍历data中的属性
      this.walk(value)
      // 创建发布订阅对象
      let emitter = new Emitter()
      // 劫持数据
      Object.defineProperty(obj, key, {
        enumerable: true, // 可枚举
        configurable: false, // 可配置
        get() {
          // 订阅数据
          Emitter.target && emitter.addSub(Emitter.target)
          return value
        },
        set: (newValue) => {
          if (newValue !== value) {
            // 递归遍历data中的属性
            this.walk(newValue)
            // 更新数据
            value = newValue
            // 发布数据
            emitter.notify()
          }
        },
      })
    }
  }

  // 观察者类
  class Watcher {
    // vm: vue实例， expr: data中的数据， cb: 回调函数
    constructor(vm, expr, cb) {
      // 获取vue实例
      this.vm = vm
      // 获取data中的数据
      this.expr = expr
      // 获取回调函数
      this.cb = cb

      // 获取data中的数据
      this.oldValue = this.get()
    }

    // 获取data中的数据
    get() {
      // 初始化发布订阅状态
      Emitter.target = this
      // 获取data中的数据
      let val = CompileTool.getVal(this.vm, this.expr)
      // 清空一下发布状态值
      Emitter.target = null
      // 返回data中的数据
      return val
    }

    // 更新data中的数据
    update() {
      // 获取data中的数据
      let newValue = CompileTool.getVal(this.vm, this.expr)
      // 判断data中的数据是否发生了改变
      if (newValue !== this.oldValue) {
        // 如果发生了改变，就调用回调函数
        this.cb(newValue)
      }
    }
  }

  // 发布订阅类 自定义事件
  class Emitter {
    constructor() {
      // 创建一个数组，用来存储订阅者
      this.subs = []
    }

    // 订阅数据
    addSub(watcher) {
      this.subs.push(watcher)
    }

    // 发布数据
    notify() {
      // 循环遍历订阅者
      this.subs.forEach((watcher) => {
        // 调用订阅者的update方法
        watcher.update()
      })
    }
  }

  // 存储指令和工具方法
  let CompileTool = {
    // 解析v-model指令
    model(node, expr, vm) {
      // exp 去掉空格
      expr = expr.trim()
      // 获取data中的数据
      let value = this.getVal(vm, expr)
      // 给元素节点添加value属性
      node.value = value

      // 创建观察者对象
      new Watcher(vm, expr, (newValue) => {
        // 如果data中的数据发生了改变，就更新元素节点中的value属性
        node.value = newValue
      })

      // 给元素节点添加input事件
      node.addEventListener('input', (e) => {
        // 获取输入框中的值
        let newValue = e.target.value
        // 判断输入框中的值是否和data中的值相等
        if (newValue !== value) {
          // 如果不相等，就将输入框中的值赋值给data中的值
          this.setVal(vm, expr, newValue)
        }
      })

      // 调用工具方法，解析文本节点中的内容
      this.update.modelUpdate(node, value)
    },
    // 解析文本节点中的内容
    text(node, expr, vm) {
      // 获取data中的数据
      let value = this.getTextVal(vm, expr)
      // 创建观察者对象
      expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        new Watcher(vm, args[1].trim(), (newValue) => {
          // 如果data中的数据发生了改变，就更新文本节点中的内容
          this.update.textUpdate(node, newValue)
        })
      })
      // 第一次编译，将data中的数据替换到文本节点中
      this.update.textUpdate(node, value)
    },
    // 获取{{}} 文本变量中的值
    getTextVal(vm, expr) {
      return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        // 注意：去掉两边空格！！！
        return this.getVal(vm, args[1].trim())
      })
    },
    // 获取data中的数据
    getVal(vm, expr) {
      // 将expr转换成数组
      expr = expr.split('.')
      // 循环遍历数组
      return expr.reduce((prev, next) => {
        return prev[next]
      }, vm.$data)
    },
    // 设置data中的数据
    setVal(vm, expr, value) {
      // 将expr转换成数组
      expr = expr.split('.')
      // 循环遍历数组
      return expr.reduce((prev, next, currentIndex) => {
        if (currentIndex === expr.length - 1) {
          return (prev[next] = value)
        }
        return prev[next]
      }, vm.$data)
    },
    // 更新节点数据方法
    update: {
      // 输入框更新
      modelUpdate(node, value) {
        node.value = value
      },
      // 文本更新
      textUpdate(node, value) {
        node.textContent = value
      },
    },
  }

  // 暴露全局变量
  window.MiniVue = MiniVue
})()
