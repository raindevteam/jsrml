"use strict";

const rpc = require('json-rpc2');

function RpcNewClient() {
    return rpc.Client.$create(5555, 'localhost');
}

class Module {

  constructor(name, desc, done) {
    this.name = name;
    this.desc = desc;
    this.Master = RpcNewClient();
    this.RpcPort = "4567";
    this.commands = new Map();
    this.triggers = new Map();
    this.startRpcServer();
    this.Master.connectSocket((err, conn) => {
        if (err) console.log(err)
        this.Master = conn
        return done();
    });
  }

  startRpcServer() {
      const server = rpc.Server.$create({});
      server.expose(this.name, {
          InvokeCommand: this.InvokeCommand.bind(this),
          Dispatch: this.Dispatch.bind(this)
      });
      server.listenRaw(parseInt(this.RpcPort), 'localhost');
  }

  InvokeCommand(cmdData, opt, callback) {
      this.commands.get(cmdData[0].Name).Fun(cmdData[0].Msg, cmdData[0].Args);
      return callback(null, "");
  }

  Dispatch(ircData, opt, callback) {
      this.triggers.forEach(function(value, key) {
          value(ircData.Msg);
      }, this.triggers);
  }

  commandHook(name, hook) {
      const data = {
          "Name": name,
          "Module": this.name
      };
      this.Master.call('Master.RegisterCommand', data, function(err, result) {});
      hook.Fun = hook.Fun.bind(this);
      this.commands.set(name, hook);
  }

  say(chan, text) {
      this.Master.call('Master.Send', chan + " :" + text, function(err, result) {});
  }

  register() {
      const data = {
          "Port": this.RpcPort,
          "Name": this.name
      };
      this.Master.call('Master.Reg', data, function(err, result) {});
  }
}

module.exports = Module;
