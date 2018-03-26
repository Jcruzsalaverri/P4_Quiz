const Sequelize = require('sequelize');
const {models} = require('./model');
const {log, biglog, errorlog, colorize} = require("./out");
/**
	* Muestra la ayuda.
	*/
exports.helpCmd = (socket, rl) => {
		log(socket, "Comandos:");
    log(socket, " h|help - Muestra esta ayuda.");
    log(socket, " list - Listar los quiz interactivamente.");
    log(socket, " show <id> - Muestra la pregunta y la respuesta a el quiz indicado.");
    log(socket, " add - Añadir un nuevo quiz interactivamente.");
    log(socket, " delete <id> - Borrar el quiz indicado.");
    log(socket, " edit <id> - Editar el quiz indicado.");
    log(socket, " test <id> - Probar el quiz indicado.");
    log(socket, " p|play - Jugar a preguntar aleatoriamente todos los quizzes.")
    log(socket, " credits - Créditos.");
    log(socket, " q|quit - Salir del programa.");
    	rl.prompt();
    };
exports.quitCmd = rl => {
	 rl.close();
   socket.end();
};
const validateId = id => {
   return new Sequelize.Promise((resolve,reject) => {
     if (typeof id === "undefined"){
       reject(new Error(`Falta el parámetro <id>.`));
     } else {
       id = parseInt(id);
       if (Number.isNaN(id)){
         reject(new Error(`El valor del parámetro <id> no es un número.`));

       } else {
         resolve(id);
       }
     }
   });
 };
/**
	* Añade nuevo quiz al modelo.
	*Pregunta interactivamente por la pregunta y por la respuesta.
	*
	*Hay que recordar que el funcionamiento de la función rl.question es asíncrono.
	*El prompt hay que sacarlo cuando ya se ha terminado la inteacción con el usuario,
	*es decir, la llamada a rl.prompt() se debe hacr en el callback de la segunda
	*llamada a rl.question
	*
	* @param rl Objeto readLine usado para implementar el CLI.
	*/
 const makeQuestion = (rl, text) => {
  return new Sequelize.Promise((resolve, reject) => {
    rl.question(colorize(text, 'red'), answer => {
      resolve(answer.trim());
    });
  });
};
 exports.addCmd = (socket, rl) => {
 	  makeQuestion(rl, ' Introduzca una pregunta: ')
 	  .then(q => {
 	    return makeQuestion(rl, ' Introduzca la respuesta ')
 	    .then(a => {
 	      return {question: q, answer: a};
 	    });
 	  })
 	  .then(quiz => {
 	    return models.quiz.create(quiz);
 	  })
 	  .then((quiz) => {
 	    log(socket, ` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`)
 	  })
 	  .catch(Sequelize.ValidationError, error => {
 	    errorlog(socket, 'El quiz es erróneo:');
 	    error.errors.forEach(({message}) => errorlog(socket, message));
 	  })
 	  .catch(error => {
 	    errorlog(socket, error.message);
 	  })
 	  .then(() => {
 	    rl.prompt();
 	  });
 	};
/**
	* Lista todos los quizzes existentes en el modelo
	*/
exports.listCmd = (socket, rl) => {
 models.quiz.findAll()
 .each(quiz => {
     log(socket, ` [${colorize(quiz.id,'magenta')}]: ${quiz.question} `);
 })
 .catch(error => {
   errorlog(socket, error.message);
 })
 .then(() => {
   rl.prompt();
 });
 };
/**
	* Muestra el quizz indicando el parámetro: la pregunta y la respuesta

	* @param id Clave del quiz a mostrar.
	*/
exports.showCmd = (socket, rl, id) => {
    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
      if (!quiz){
        throw new Error(`No existe un quiz asociado al id=${id}.`);
      }
      log(socket, `[${colorize(quiz.id,'magenta')}]: ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);
    })
    .catch(error => {
      errorlog(socket, error.message);
    })
    .then(() => {
      rl.prompt();
    });
};
exports.testCmd = (socket, rl, id) => {

        validateId(id)
            .then(id => models.quiz.findById(id))
            .then(quiz => {
                if (!quiz) {
                    throw new Error(`No existe la pregunta asociada al id= ${id}.`);
                }
                        return makeQuestion(rl, `${quiz.question} ? `)
                            .then(a => {
                                if(a.toLowerCase().trim() === quiz.answer.toLowerCase().trim()){
                                    log(socket, 'CORRECTO', 'green');
                                }else {
                                    log(socket, 'INCORRECTO', 'green');
                                }
                            });
            })
            .catch(Sequelize.ValidationError, error => {
                error.log(socket, 'Quiz erroneo');
                error.errors.forEach(({message}) => errorlog(socket, message));
            })
            .catch(error => {
                errorlog(socket, error.message);
            })
            .then(() => {
                rl.prompt();
            });

};
exports.playCmd = (socket, rl) => {
  let score = 0;
  let toBeResolved = new Array();
  models.quiz.findAll()
    .then(quizzes => {
      quizzes.forEach((quiz, id) => {
        toBeResolved[id] = quiz;
      });
      const jugar = () => {
        if (toBeResolved.length === 0) {
          log(socket, `Preguntas correctas: ${colorize(score, "green")}`, "green");
          rl.prompt();
        } else {
          var azar = Math.floor(Math.random() * toBeResolved.length);
          let quiz = toBeResolved[azar];
          toBeResolved.splice(azar, 1);
          return makeQuestion(rl, quiz.question)
            .then(a => {
              if (a.toLowerCase().trim() == quiz.answer.toLowerCase().trim()) {
                score++;
                biglog(socket, 'Correcto', 'green');
                log(socket, `Preguntas acertadas: ${colorize(score, "green")}`, "green");
                log(socket, `fin`, "red");
                jugar();
              } else {
                log(socket, "incorrecta", "red");
                log(socket, `fin`, "red");
                rl.prompt();
              }
            })
            .catch(error => {
              errorlog(socket, error.message);
            })
                        .catch(Sequelize.ValidationError, error => {
              errorlog(socket, "El quiz no existe: ");
              log(socket, `fin`, "red");
              error.errors.forEach(({ message }) => errorlog(socket, message));
            })
            .then(() => {
              rl.prompt();
            });
        }
      }
      jugar();
    });
}
/**
	* Borra un quiz del modelo
	* @param id Clave del quiz a borrar en el modelo.
	*/
exports.deleteCmd = (socket, rl, id) => {
validateId(id)
.then(id => models.quiz.destroy({where: {id}}))
.catch(error => {
  errorlog(socket, error.message);
})
.then(() => {
  rl.prompt();
});
};
/**
	* Edita un quiz del modelo
	* @param id Clave del quiz a editar
	 en el modelo.
	*/
exports.editCmd = (socket, rl, id) => {
   validateId(id)
   .then(id => models.quiz.findById(id))
   .then(quiz => {
     if (!quiz){
       throw new Error(`No existe un quiz asociado al id=${id}.`);
     }
     process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
     return makeQuestion(rl, ' Introduzca la pregunta: ')
     .then(q => {
       process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
       return makeQuestion(rl, 'Introduzca la respuesta ')
       .then(r => {
         quiz.question = q;
         quiz.answer = r;
         return quiz;
       });
     });
   })
   .then(quiz => {
     return quiz.save();
   })
   .then(quiz => {
     log(socket, `Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`)
   })
    .catch(Sequelize.ValidationError, error => {
 	    errorlog(socket, 'El quiz es erróneo:');
 	    error.errors.forEach(({message}) => errorlog(message));
 	  })
 	  .catch(error => {
 	    errorlog(error.message);
 	  })
 	  .then(() => {
 	    rl.prompt();
 	  });
};
exports.creditsCmd = (socket, rl) => {
    	log(socket, 'Autor de la práctica:');
    	log(socket, 'JAVIER Cruz Salaverri');
    	log(socket, 'Nombre 2');
    	rl.prompt();

};