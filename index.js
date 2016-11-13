"use strict";

const portfinder = require('portfinder');
const rpc        = require('json-rpc2');
const Q          = require('q');

function RpcNewClient(port) {
    return rpc.Client.$create(parseInt(port), 'localhost');
}

class Module {

  constructor(name, desc) {
    this.name = name;
    this.desc = desc;
    this.rpc = null;
    this.commands = new Map();
    this.triggers = new Map();
    this.cleanupFunction;
  }

  startRpcServer(port) {
      const server = rpc.Server.$create({});
      server.expose(this.name.toLowerCase(), {
          InvokeCommand: this.invokeCommand.bind(this),
          Dispatch: this.dispatch.bind(this),
          Cleanup: this.cleanup.bind(this)
      });
      server.listenRaw(port, 'localhost');
  }

  /* Separate rpc logic from module */

  invokeCommand(cmdData, opt, callback) {
      try {
          this.commands.get(cmdData[0].Name).Fun(cmdData[0].Msg, cmdData[0].Args);
      } catch (e) {
          return callback(e, "");
      }
      
      return callback(null, "");
  }

  dispatch(ircData, opt, callback) {
      this.triggers.forEach(function(value, key) {
          value(ircData.Msg);
      }, this.triggers);
      return callback(null, "");
  }

  cleanup(reason, opt, callback) {
      if (this.cleanupFunc) {
          const clean = Q.nbind(this.cleanupFunc(), this)
          clean()
          .then(() => {
              return callback(null, "");
          })
          .fail((error) => {
             return callback(new Error(error), "");
          });
      } else {
          return callback(null, "");
      }
  }

  addCommand(name, hook) {
      hook.Fun = hook.Fun.bind(this);
      this.commands.set(name, hook);
  }

  registerCommand(name) {
      const data = {
          "CommandName": name,
          "ModuleName": this.name
      };
      this.Master.call('Master.RegisterCommand', data, function(err, result) {});
  }

  say(chan, text) {
      this.Master.call('Master.Send', chan + " :" + text, function(err, result) {});
  }

  register(args) {
      portfinder.getPort((err, port) => {
        this.startRpcServer(port);
        if (err) {
            console.error("Here is err: " + err)
        }
        this.Master = RpcNewClient(args[2]).connectSocket();
        this.commands.forEach((val, key) => {
            this.registerCommand(key)
        });
        const data = {
            "Port": port.toString(),
            "ModuleName": this.name
        };
        this.Master.call('Master.Register', data, function(err, result) {
            if (err) console.error(err);
        });
      });
  }
}

module.exports = Module;
