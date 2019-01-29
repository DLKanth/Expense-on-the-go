'use strict';

const functions = require('firebase-functions');
const DialogflowApp = require('actions-on-google').DialogflowApp;
const firebaseAdmin = require('firebase-admin');

firebaseAdmin.initializeApp(functions.config().firebase);

exports.myExpenses = functions.https.onRequest((request, response) => {

	const dialogFlowApp = new DialogflowApp({request, response});

	const actionMap = new Map();
	actionMap.set('input.welcome', welcomeIntent);
	actionMap.set('add.expense', addExpense);
	actionMap.set('add.income', addIncome);
	actionMap.set('input.passbook', getPassbook);



	actionMap.set(dialogFlowApp.StandardIntents.OPTION, () => {
		dialogFlowApp.ask('You can share your income, expense or ask for statement. What would you want me to do?');
	});

	dialogFlowApp.handleRequest(actionMap);

})

function welcomeIntent(dfApp) {

	const uid = dfApp.getUser().userId;
	return isUserExsit(uid).then(isExist => {
		if (isExist) {
		} else {
			addUser(uid);
		}

		const welcomeSimpleResponse = 'Hello! welcome to expense on the go. You can share your income and expense or ask for the statement.';
		const welcomeSuggestionChips = ['add a expense', 'add a income', 'show my passbook'];

		if (isSurfaceAvailable(dfApp)) {
			dfApp.ask(dfApp
			     .buildRichResponse()
				.addSimpleResponse(welcomeSimpleResponse)
				.addSuggestions(welcomeSuggestionChips));
		} else {
			dfApp.ask(welcomeSimpleResponse);
		}

		return isExist
	});

}

function getTime(timestamp) {
	var transactionDate = new Date(timestamp);
	console.log(transactionDate);
	var speechText = transactionDate.getDate() + "th ";

	var monthNames = ["January", "February", "March", "April", "May", "June",
  		"July", "August", "September", "October", "November", "December"];
	var month = monthNames[transactionDate.getMonth()];
	var speechText = speechText + month;
	return speechText;
}

function getPassbook(dfApp) {
	const uid = dfApp.getUser().userId;


	getDbRefToPassbook(uid).then(ref => {
		ref.orderByKey().limitToLast(5).once('value').then(snapshot => {

			var response = '';
			if (snapshot !== null) {
				snapshot.forEach(data => {
					const transaction = data.val();
					if (transaction.type === 'income') {
						response = response + 'earned ' + transaction.amount + ' on ' + getTime(transaction.timestamp) +' described as \"'+ transaction.description +'\",  ';
					} else {
						response = response + 'spent ' + transaction.amount + ' on ' + getTime(transaction.timestamp) +' described as \"'+ transaction.description +'\",  ';
					}
				});

				if (response !== '') {
					response = 'Here is your last few transactions, ' + response;
					dfApp.tell(response);

				} else {
					response = 'No transaction found in your account. Share your income and expense with me';

					if (isSurfaceAvailable(dfApp)) {
						dfApp.ask(dfApp.buildRichResponse()
							.addSimpleResponse(response)
							.addSuggestions(['add a expense', 'add a income']));
					} else {
						dfApp.ask(response);
					}
				}


			} else {

				if (isSurfaceAvailable(dfApp)) {
						dfApp.ask(dfApp.buildRichResponse()
							.addSimpleResponse('No transaction found in your account. Share your income, expense with me')
							.addSuggestions(['add a expense', 'add a income']));
				} else {
						dfApp.ask('No transaction found in your account. Share your income, expense with me');
				}

			}

		});
	});

}

function addIncome(dfApp) {
	const uid = dfApp.getUser().userId;

	const amount = dfApp.getArgument('number');
	const description = dfApp.getArgument('description');

	const INCOME = 'income';

	const income = {
		amount: amount,
		description: description,
		type: INCOME,
		timestamp: Date.now()
	};


	getDbRefToAddUserData(uid).then(ref => {
				ref.set(income);
			});

	dfApp.tell('Recorded your earning');
}


function addExpense(dfApp) {
	const uid = dfApp.getUser().userId;

	const amount = dfApp.getArgument('number');
	const description = dfApp.getArgument('description');

	const EXPENSE = 'expense';


	const expense = {
		amount: amount,
		description: description,
		type: EXPENSE,
		timestamp: Date.now()
	}
	
	getDbRefToAddUserData(uid).then(ref => {
		ref.set(expense);
	});
	
	dfApp.tell('Recorded your expense');
}


function isUserExsit(userId) {
	return getDbRefToUser(userId)
				.then(ref => ref.once('value'))
				.then(snapshot => snapshot.val())
				.then(user => {
					console.log('user :' + user);
					return user !== null;
				});
}

function addUser(userId) {
	return getDbRefToUser(userId).then(ref => ref.set({id : userId}))
}

function getDbRefToUser(userId) {
	return Promise.resolve(firebaseAdmin.database().ref('users/' + userId));
}

function getDbRefToUserBalance(userId) {
	return Promise.resolve(firebaseAdmin.database().ref('users/' + userId + "/balance"))
}

function getDbRefToAddUserData(userId) {
	return Promise.resolve(firebaseAdmin.database().ref('users/' + userId + "/passbook/" + Date.now()))
}

function getDbRefToPassbook(userId) {
	return Promise.resolve(firebaseAdmin.database().ref('users/' + userId + "/passbook"));
}

function isSurfaceAvailable(dfApp) {
	return dfApp.hasSurfaceCapability(dfApp.SurfaceCapabilities.SCREEN_OUTPUT);
}
 