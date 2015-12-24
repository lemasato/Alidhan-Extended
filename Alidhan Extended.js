// ==UserScript==
// @name        Alidhan Extended
// @namespace   https://greasyfork.org/scripts/15268
// @description	Alidhan devient plus aisé!
// @include     *.alidhan.net/carte
// @include     *.alidhan.net/pnj/*
// @include 	about:blank?alidhan_script
// @grant       GM_getValue
// @grant       GM_setValue
// @grant 	GM_deleteValue
// @grant	GM_openInTab
// @grant	GM_registerMenuCommand
// @version	1.0.01
// ==/UserScript==

/* MAIN FUNCTION */
var functionMain = function() {

    /* VARIABLES & CONSTS */

    const MAP_URL = 'http://www.alidhan.net/carte';
    const PANEL_URL = 'about:blank?alidhan_script';
    const CURRENT_URL = window.location;

    const REG_LOG_CONTENT = /(.*) sur .*Vous( lui | )infligez <b>(.*)<\/b> points de (dégâts au monstre|dommage)/;
    const REG_LIFE = /(.*)\/(.*)/;
    const REG_POTION_COOLDOWN = /Cooldown soins/;
    const REG_NOT_MAP = new RegExp('ecran/mort\.png|ecran/auberge\_new\.png');
    const REG_MAP = new RegExp('http://data2\.alidhan\.net/img/map/');
    const REG_PUB = new RegExp('http://(?!www\.alidhan)');
    const REG_SKILL_IMG = new RegExp('http://data2\.alidhan\.net/img/competence/');
    const REG_POTION_IMG = new RegExp('http://data2\.alidhan\.net/img/potion/');
    const REG_AJAX = new RegExp('^action_map\\(\'[^(]*\'\\);$');

    const BOT_INTERVAL = 500; // minimum interval (ms) between bot's actions

    var CFG = new Array();
    var oOptions = new Array();
    var potionWaiting = false;
    var inputSelected = false;
    var MAP_VIEW = false;
    var oSkillsButtons = new Array();
    var oPotionsButtons = new Array();


    /** SCRIPT **/

    var startScript = function() { // launch the script
        loadConfiguration();
        if (CFG['fast_inn']) fastInn();
        if (CURRENT_URL == MAP_URL) {
            if (REG_MAP.test(document.body.innerHTML.toString())) MAP_VIEW = true;
            if (document.getElementById('loading')) document.getElementById('loading').addEventListener('DOMAttrModified', callbackRefresh, false);
            createCommands();
            getButtons();
            enableShortcuts();
            window.setInterval(loadConfiguration, 10000);
            if (CFG['auto_xp']) setInterval(autoXP, 1000);
            //else if (CFG['auto_potion']) autoPotion();
            //        setInterval(refreshMap, 1000);
            if (CFG['auto_refresh']) window.setTimeout(autoRefresh, CFG['interval_refresh'] * 1000);
        } else if (CURRENT_URL == PANEL_URL) {
            createPanel();
            window.setInterval(refreshPanel, 10000);
        }
    };

    var restartScript = function() {
        window.location.assign(MAP_URL);
    };

    var showHelp = function() {
        alert("Bienvenue sur l'aide d'Alidhan Extended!\nCe script remet à jour l'original datant de 2010.\n\nRaccourcis :\n\nH: Aide\nP: Configuration\n\nE: Compétence par défaut\nR: Potion par défaut\nO: Bot XP Auto\n\nBOT XP Auto: Cliquer ou une pression du clavier le désactivera automatiquement\nLa compétence et potion utilisées seront celles choisies par défaut dans la configuration (touche P).");
    };

    var loadConfiguration = function() {
        CFG['fast_inn'] = GM_getValue('cfg_fast_inn', true);
        CFG['record_logs'] = GM_getValue('cfg_record_logs', true);
        CFG['auto_xp'] = GM_getValue('cfg_auto_xp', false);
        CFG['auto_potion'] = GM_getValue('cfg_auto_potion', false);
        CFG['q_key'] = GM_getValue('cfg_q_key', false);
        CFG['diff_life'] = parseInt(GM_getValue('cfg_diff_life', 500));
        CFG['skill_def'] = parseInt(GM_getValue('cfg_skill_def', 1));
        CFG['potion_def'] = parseInt(GM_getValue('cfg_potion_def', 1));
        CFG['auto_refresh'] = GM_getValue('cfg_auto_refresh', false);
        CFG['interval_refresh'] = parseInt(GM_getValue('cfg_interval_refresh', 10));
    };


    /** STATS **/

    var resetStats = function() {
        GM_deleteValue('stats_skill');
        GM_deleteValue('stats_nb_logs');
        GM_deleteValue('stats_average');
        GM_deleteValue('stats_min');
        GM_deleteValue('stats_max');
        window.location.assign(PANEL_URL);
    };

    var saveLog = function(skill, val) {
        var stats = getStats();
        var i = 0;
        var idSkill = -1;
        for each(var skillName in stats['skill']) {
            if (skillName == skill) {
                idSkill = i;
                break;
            }
            i++;
        }
        if (idSkill == -1) { // new skill
            stats['skill'].push(skill);
            stats['nb_logs'].push(1);
            stats['average'].push(val);
            stats['min'].push(val);
            stats['max'].push(val);
        } else {
            if (val > parseInt(stats['max'][idSkill])) stats['max'][idSkill] = val;
            if (val < parseInt(stats['min'][idSkill])) stats['min'][idSkill] = val;
            stats['average'][idSkill] = Math.round((parseInt(stats['average'][idSkill]) * parseInt(stats['nb_logs'][idSkill]) + val) / (parseInt(stats['nb_logs'][idSkill]) + 1));
            stats['nb_logs'][idSkill] = parseInt(stats['nb_logs'][idSkill]) + 1;
        }
        GM_setValue('stats_skill', stats['skill'].join(':|:'));
        GM_setValue('stats_nb_logs', stats['nb_logs'].join(':|:'));
        GM_setValue('stats_average', stats['average'].join(':|:'));
        GM_setValue('stats_min', stats['min'].join(':|:'));
        GM_setValue('stats_max', stats['max'].join(':|:'));
    };

    var getStats = function(numStats) {
        var stats = new Array();
        stats['skill'] = GM_getValue('stats_skill', '').split(':|:');
        stats['nb_logs'] = GM_getValue('stats_nb_logs', '').split(':|:');
        stats['average'] = GM_getValue('stats_average', '').split(':|:');
        stats['min'] = GM_getValue('stats_min', '').split(':|:');
        stats['max'] = GM_getValue('stats_max', '').split(':|:');
        return stats;
    };



    /** KEYBOARD **/

    var enableShortcuts = function() {
        if (CFG['auto_xp']) {
            window.addEventListener('keydown', disableAutoXP, false);
            window.addEventListener('mousedown', disableAutoXP, false);
        } else {
            var callback = function(event) {
                var key = event.which;
                if (MAP_VIEW) {
                    if (key == 69) useSkill(CFG['skill_def']); // E
                    //if (key == 82) resetStats(); // R
                    if (key == 79) enableAutoXP(); // O
                    if (key == 82) usePotion(CFG['potion_def']); // R
                    //if (key == 69) enableAutoXP(); // E
                    //if (key == 82) autoXP(); // R
                }
                if (key == 80) openPanel(); // P
                else if (key == 72) showHelp(); // H
            }
        };
        window.addEventListener('keydown', callback, true);
    };


    /*	    var	enableShortcuts = function() {
        	if(CFG['auto_xp']) {
        		window.addEventListener('keydown', disableAutoXP, false);
        		window.addEventListener('mousedown', disableAutoXP, false);
        	} else {
        		var callback = function(event) {
        			var key = event.keyCode;
        			//if(MAP_VIEW) {
        				var attackKey = 65; // A
        				if(CFG['q_key']) attackKey = 81; // Q
        				if(key == 82) refreshMap(); // R
        				else if(key == 69) usePotion(CFG['potion_def']); // E
        				else if(key == attackKey) useSkill(CFG['skill_def']); // Attack Key
        				else if(key == 79) enableAutoXP(); // O
        			// }
        			if(key == 80) openPanel(); // P
        			else if(key == 72) showHelp(); // H
        		};
        		window.addEventListener('keydown', callback, true)
        	}
        };	*/


    /** MOUSE **/

    var simulateClick = function(obj) {
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("click", true, true);
        obj.dispatchEvent(evt);
    };

    /** POTIONS **/

    var usePotion = function(idPotion) {
        if (idPotion != null && oPotionsButtons[idPotion] != null) {
            var life = getPlayerLife();
            if ((life['current'] > 0) && (life['max'] - life['current'] != 0))
                simulateClick(oPotionsButtons[idPotion], "click");
        }
    };

    var getPotionCooldown = function() {
        var cooldown = 0;
        if (document.getElementById('barre_fixe_chrono') && document.getElementsByClassName('barre_fixe_chrono_potion')) {
            if (REG_POTION_COOLDOWN.test(document.getElementById('barre_fixe_partie_2').innerHTML)) {
                cooldown = parseInt(document.getElementById('barre_fixe_chrono_potion').innerHTML);
                //if(cooldown > 4) cooldown = 0;
            }
        }
        return cooldown;
    };

    var takePotionWhenPossible = function(idPotion) {
        if (idPotion != null) {
            var cooldown = getPotionCooldown();
            if (cooldown == 0) {
                potionWaiting = false;
                usePotion(idPotion);
            } else if (!potionWaiting) {
                potionWaiting = true;
                window.setTimeout(takePotionWhenPossible, cooldown * 1000, idPotion);
            }
        }
    };

    var autoPotion = function() {
        var nextAction = BOT_nextAction();
        if (nextAction == 0) {
            BOT_actionExecuted();
            var life = getPlayerLife();
            if ((life['current'] > 0) && (life['max'] - life['current'] > CFG['diff_life'])) {
                takePotionWhenPossible(CFG['potion_def']);
            }
        } else window.setTimeout(autoPotion, nextAction);
    };


    /** MAP **/

    var refreshMap = function() {
        window.location.assign(MAP_URL);
    };

    var autoRefresh = function() {
        if (!CFG['auto_xp'] && !potionWaiting) {
            refreshMap();
        }
    };

    var callbackRefresh = function() { // function appelée après un rafraichissement
        if (MAP_VIEW && document.getElementById('loading')) {
            if (CFG['auto_refresh']) window.setInterval(autoRefresh, CFG['interval_refresh'] * 1000);
            //    if (document.getElementById('loading').style.display == 'none') {
            if (CFG['record_logs']) {
                if (document.getElementById('zone_log')) {
                    var retour;
                    if (retour = document.getElementById('zone_log').innerHTML.match(REG_LOG_CONTENT)) {
                        setTimeout(
                            (function(nom, valeur) {
                                return function() {
                                    saveLog(nom, parseInt(valeur));
                                };
                            })(retour[1], retour[3]), 0);
                    }
                }
            }
            if (CFG['auto_xp']) {
                window.setTimeout(autoXP, 100);
            } else if (CFG['auto_potion']) {
                window.setTimeout(autoPotion, 100);
            }
            //}
        }
    };

    /** FAST INN **/

    var fastInn = function() {
        var reg_pnj = new RegExp('http://www\.alidhan\.net/pnj/');
        if (reg_pnj.test(document.location)) {
            var oLinks = document.getElementsByTagName('a');
            var innLink = false;
            var nbMatch = 0;
            for each(var oLink in oLinks) {
                if (oLink.firstChild.textContent == 'Prendre une chambre') {
                    innLink = oLink;
                    window.location.assign(innLink);
                }
            }
        }
    };


    /** PLAYER **/

    var getPlayerLife = function() {
        var life = new Array();
        life['current'] = 0;
        life['max'] = 0;
        if (document.getElementById('texte_barre_vie')) {
            var retour;
            if (retour = REG_LIFE.exec(document.getElementById('texte_barre_vie').innerHTML)) {
                life['current'] = parseInt(retour[1].replace(' ', ''));
                life['max'] = parseInt(retour[2].replace(' ', ''));
            }
        }
        return life;
    };


    /** BUTTONS **/

    var getButtons = function() {
        var skills = new Array();
        var potions = new Array();
        var nbSkills = 0;
        var nbPotions = 0;
        var imgs = document.getElementsByTagName('img');
        var img = false;
        var oLink = false;
        var imgSrc = '';
        var js = '';
        var nb_imgs = imgs.length;
        for (var i = 0; i < nb_imgs; i++) {
            oLink = imgs[i].parentNode;
            if (oLink.nodeName == 'A' && oLink.parentNode.nodeName == 'LI') {
                imgSrc = imgs[i].getAttribute('src');
                if (REG_SKILL_IMG.test(imgSrc)) {
                    js = oLink.getAttribute('onclick');
                    if (REG_AJAX.test(js)) {
                        nbSkills++;
                        skills[nbSkills] = imgs[i];
                    }
                } else if (REG_POTION_IMG.test(imgSrc)) {
                    js = oLink.getAttribute('onclick');
                    if (REG_AJAX.test(js)) {
                        nbPotions++;
                        potions[nbPotions] = imgs[i];
                    }
                }
            }
        }
        if (nbSkills < 21 && nbPotions < 3) {
            oSkillsButtons = skills;
            oPotionsButtons = potions;
        }
    };


    /** ATTACKS **/

    var useSkill = function(idSkill) {
        if (idSkill != null && oSkillsButtons[idSkill] != null) {
            simulateClick(oSkillsButtons[idSkill]);
        }
    };


    /** BOT **/

    var BOT_nextAction = function() { // get time left until next action possible
        var lastAction = parseInt(GM_getValue('bot_last_action', 0));
        var currentTime = new Date().getTime();
        var timeLeft = BOT_INTERVAL - (currentTime - lastAction);
        if (timeLeft <= 0) timeLeft = 0;
        else timeLeft += 50;
        return timeLeft;
    };

    var BOT_actionExecuted = function() { // warn that a bot action was executed
        var currentTime = new Date().getTime();
        GM_setValue('bot_last_action', currentTime.toString());
    };


    /** AUTO XP **/

    var enableAutoXP = function() {
        GM_setValue('cfg_auto_xp', true);
        //alert('Alidhan Script :\n\nXP automatique activé.\nCliquez ou appuyez sur une touche pour le désactiver.');
        restartScript();
    };

    var disableAutoXP = function() {
        GM_setValue('cfg_auto_xp', false);
        restartScript();
    };

    var autoXP = function() {
        var nextAction = BOT_nextAction();
        if (nextAction == 0) {
            BOT_actionExecuted();
            var life = getPlayerLife();
            if ((life['current'] > 0) && (parseInt(life['max'] - life['current']) > CFG['diff_life'])) { // si la vie est inférieure au seuil
                takePotionWhenPossible(CFG['potion_def']);
            } else { // si la vie est ok
                if (document.getElementById('content_pve')) { // si un monstre est présent
                    useSkill(CFG['skill_def']);
                } else { // si aucun monstre n'est présent
                    window.setTimeout(refreshMap, 2000);
                }
            }
        } else window.setTimeout(autoXP, nextAction);
    };


    /** COMMANDS **/

    var createCommands = function() {
        GM_registerMenuCommand('AlidhanEXT: Aide', showHelp);
        GM_registerMenuCommand('AlidhanEXT: Configurer', openPanel);
        //GM_registerMenuCommand('AlidhanEXT: BOT XP Auto', enableAutoXP);
    };

    /** PANEL **/

    var openPanel = function() {
        //alert('Alidhan Script :\n\nLe panneau de configuration va s\'ouvrir dans un nouvel onglet.');
        GM_openInTab(PANEL_URL);
    };

    var createOption = function(oParent, textName, optionType, saveName) {
        if (optionType == null) optionType = 'checkbox';
        var oOption = document.createElement('p');
        var oText = document.createElement('label');
        oText.appendChild(document.createTextNode(textName));
        oText.style.display = 'block';
        oText.style.cssFloat = 'left';
        oText.style.width = '500px';
        oOption.appendChild(oText);
        var oInput = document.createElement('input');
        if (optionType == 'checkbox') {
            oInput.setAttribute('type', 'checkbox');
            if (CFG[saveName]) oInput.setAttribute('checked', 'checked');
        } else if (optionType == 'value') {
            oInput.setAttribute('type', 'text');
            oInput.style.width = '30px';
            oInput.setAttribute('value', CFG[saveName]);
            oInput.addEventListener('focus', function() {
                inputSelected = true;
            }, true);
            oInput.addEventListener('blur', function() {
                inputSelected = false;
            }, true);
        }
        oInput.setAttribute('name', saveName);
        oInput.addEventListener('change', saveChanges, true);
        oOption.appendChild(oInput);
        oParent.appendChild(oOption);
        oOptions.push(oInput);
        return oInput;
    };

    var createPanel = function() {
        var oWindow = document.createElement('div');
        oWindow.style.border = '2px grey solid';
        oWindow.style.MozBorderRadius = '15px';
        oWindow.style.backgroundColor = 'lightblue';
        var oTitle = document.createElement('h1');
        oTitle.style.fontFamily = 'Segoe UI';
        oTitle.style.textAlign = 'center';
        oTitle.style.marginTop = '20px';
        oTitle.style.height = '40px';
        oTitle.appendChild(document.createTextNode('Alidhan Extended'));
        oWindow.appendChild(oTitle);
        var oContent = document.createElement('div');
        oContent.style.margin = '50px';
        oContent.style.fontFamily = 'Verdana';
        oContent.style.fontWeight = '';
        oWindow.appendChild(oContent);
        document.body.appendChild(oWindow);
        var oConfTitle = document.createElement('h3');
        oConfTitle.appendChild(document.createTextNode('Configuration :'));
        oConfTitle.style.marginBottom = '25px';
        oContent.appendChild(oConfTitle);
        createOption(oContent, 'Auberge rapide', 'checkbox', 'fast_inn');
        createOption(oContent, 'Enregistrement des logs', 'checkbox', 'record_logs');
        createOption(oContent, 'Rafraichissement automatique de la carte', 'checkbox', 'auto_refresh');
        createOption(oContent, 'Rafraichissement automatique (interval en secondes)', 'value', 'interval_refresh');
        createOption(oContent, 'Potion automatique', 'checkbox', 'auto_potion');
        createOption(oContent, 'Potion automatique (différence de vie)', 'value', 'diff_life');
        //createOption(oContent, 'Attaquer avec la touche Q (à la place de A)', 'checkbox', 'q_key');
        createOption(oContent, 'Compétence par défaut (1-20)', 'value', 'skill_def');
        createOption(oContent, 'Potion par défaut (1-2)', 'value', 'potion_def');
        var oStatsTitle = document.createElement('h3');
        oStatsTitle.appendChild(document.createTextNode('Logs: (léger bug qui prend parfois la compétence deux fois en compte)'));
        oStatsTitle.style.marginTop = '25px';
        oStatsTitle.style.marginBottom = '25px';
        oStatsTitle.style.cssFloat = 'left';
        oContent.appendChild(oStatsTitle);
        var oReset = document.createElement('input');
        oReset.setAttribute('type', 'submit');
        oReset.setAttribute('value', 'Remise à zero');
        oReset.style.display = 'block';
        oReset.style.marginTop = '22px'
        oReset.style.marginLeft = '170px'
        oReset.style.width = '100px';
        oReset.style.cssFloat = 'left';
        oReset.addEventListener('click', resetStats, false);
        oContent.appendChild(oReset);
        var oTable = document.createElement('table');
        oTable.style.clear = 'left';
        oTable.style.border = '1px grey solid';
        oTable.style.padding = '5px';
        var oTableHeader = document.createElement('tr');
        var headers = new Array('Compétence', 'Nombre de logs', 'Minimum', 'Maximum', 'Moyenne');
        for each(var header in headers) {
            var oTableTh = document.createElement('th');
            oTableTh.appendChild(document.createTextNode(header));
            oTableTh.style.width = '150px';
            oTableHeader.appendChild(oTableTh);
        }
        oTable.appendChild(oTableHeader);
        var stats = getStats();
        var columns = new Array('skill', 'nb_logs', 'min', 'max', 'average');
        var nbSkills = stats['skill'].length;
        if (nbSkills) {
            for (var i = 0; i < nbSkills; i++) {
                var oTableRow = document.createElement('tr');
                oTableRow.style.border = '1px grey solid';
                for each(var column in columns) {
                    var oTableTd = document.createElement('td');
                    oTableTd.appendChild(document.createTextNode(stats[column][i]));
                    oTableTd.style.textAlign = 'center';
                    oTableRow.appendChild(oTableTd);
                }
                oTable.appendChild(oTableRow);
            }
        }
        oContent.appendChild(oTable);
    };

    var saveChanges = function() {
        for each(var oInput in oOptions) {
            if (oInput.getAttribute('type') == 'checkbox') {
                if (oInput.checked) GM_setValue('cfg_' + oInput.getAttribute('name'), true);
                else GM_setValue('cfg_' + oInput.getAttribute('name'), false);
            } else if (oInput.getAttribute('type') == 'text') {
                GM_setValue('cfg_' + oInput.getAttribute('name'), parseInt(oInput.value));
            }
        }
        window.location.assign(PANEL_URL);
    };

    var refreshPanel = function() {
        if (!inputSelected) window.location.replace(PANEL_URL);
    };


    /** LAUNCH SCRIPT **/

    startScript();

}; // functionMain()


/** LAUNCH MAIN FUNCTION **/
window.addEventListener('load', functionMain, false);