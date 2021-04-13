import { ProxyRules } from "../core/ProxyRules";
import { CompiledProxyRule, CompiledProxyRuleType } from "../core/definitions";
import { Utils } from "./Utils";



export class RulesBenchmark {
    // public static async benchmarkRules(testRules: CompiledProxyRule[] = null, testUrls: string[] = null) {
    //     console.info('benchmarkRules is disabled!');
    //     return null;
    // }
    private static sampleUrls = ["", ""];

    public static async benchmarkRules(testRules: CompiledProxyRule[] = null, testUrls: string[] = null) {
        debugger;
        var urls: string[] = testUrls;
        var rules: CompiledProxyRule[] = testRules;
        if (urls == null)
            urls = this.sampleUrls;

        if (rules == null)
            rules = ProxyRules.getCompiledRulesList();

        var finalResult = `Benchmarking ${rules.length} rules on ${urls.length} urls \r\n`;
        var resultList = [];

        for (const url of urls) {
            finalResult += `+--------------------------------------------------------\r\n`;
            finalResult += `Testing Url: ${url} \r\n`;

            var thisUrlTimeList = [];
            var allRulesTime = this.timer();
            for (const rule of rules) {

                var ruleName = '';
                if (rule.ruleText) {
                    ruleName = `${rule.ruleText}`;
                }
                else {
                    ruleName = `${rule.regex}`;
                }

                var time = this.timer();
                var oneResult = this.testSingleRuleInternal(url, rule);

                time.stop();

                finalResult += `Elapsed: ${time.time} for '${url}' , match: ${oneResult.match} \r\n`;

                if (time.time > 0) {
                    resultList.push({ time: time.time, rule: ruleName, url: url });
                    thisUrlTimeList.push({ time: time.time, rule: ruleName });
                }
            }

            allRulesTime.stop();
            if (allRulesTime.time > 0) {

                thisUrlTimeList.sort((a, b) => {
                    if (a.time === b.time) return 0;
                    if (a.time < b.time) return 1;
                    return -1;
                });

                resultList.push({ time: allRulesTime.time, rule: `[ALL ${rules.length} RULES TIME]`, thisUrlTimeList: thisUrlTimeList, url: url });
            }
        }

        resultList.sort((a, b) => {
            if (a.time === b.time) return 0;
            if (a.time < b.time) return 1;
            return -1;
        });

        //console.info(finalResult);
        console.info(resultList);
        console.info(JSON.stringify(resultList));
        return finalResult;
    }

    public static async benchmarkRules_RulesOnUrls(testRules: CompiledProxyRule[] = null, testUrls: string[] = null) {
        debugger;
        var urls: string[] = testUrls;
        var rules: CompiledProxyRule[] = testRules;
        if (urls == null)
            urls = this.sampleUrls;

        if (rules == null)
            rules = ProxyRules.getCompiledRulesList();

        var finalResult = `Benchmarking ${rules.length} rules on ${urls.length} urls \r\n`;
        var resultList = [];

        for (const rule of rules) {
            finalResult += `+--------------------------------------------------------\r\n`;

            var ruleName = '';
            if (rule.ruleText) {
                finalResult += `Testing rule: ${rule.ruleText}  for ${rule.hostName} \r\n`;
                ruleName = `${rule.ruleText}`;
            }
            else {
                finalResult += `Testing rule: ${rule.regex} \r\n`;
                ruleName = `${rule.regex}`;
            }

            for (const url of urls) {
                var time = this.timer();
                var oneResult = this.testSingleRuleInternal(url, rule);

                time.stop();

                finalResult += `Elapsed: ${time.time} for '${url}' , match: ${oneResult.match} \r\n`;

                if (time.time > 0)
                    resultList.push({ time: time.time, rule: ruleName, url: url });
            }
        }

        resultList.sort((a, b) => {
            if (a.time === b.time) return 0;
            if (a.time < b.time) return 1;
            return -1;
        });

        //console.info(finalResult);
        console.info(resultList);
        return finalResult;
    }

    private static testSingleRuleInternal(domain: string, rule: CompiledProxyRule): {
        match: boolean,
        rule: CompiledProxyRule
    } {
        // the url should be complete
        let url = domain.toLowerCase();
        if (!url.includes(":/"))
            url = "http://" + url;
        let domainHost: string = null;
        let schemaLessUrl: string;


        switch (rule.compiledRuleType) {
            case CompiledProxyRuleType.Exact:
                if (url == rule.search)
                    return {
                        match: true,
                        rule: rule
                    };
                break;

            case CompiledProxyRuleType.RegexHost:

                if (domainHost == null) {
                    domainHost = Utils.extractHostFromUrl(url);
                    if (domainHost == null) {
                        break;
                    }
                }

                if (rule.regex.test(domainHost))
                    return {
                        match: true,
                        rule: rule
                    };
                break;

            case CompiledProxyRuleType.RegexUrl:

                if (rule.regex.test(url))
                    return {
                        match: true,
                        rule: rule
                    };
                break;

            case CompiledProxyRuleType.SearchUrl:

                if (url.startsWith(rule.search))
                    return {
                        match: true,
                        rule: rule
                    };
                break;

            case CompiledProxyRuleType.SearchDomain:

                if (domainHost == null) {
                    domainHost = Utils.extractHostFromUrl(url);
                    if (domainHost == null) {
                        break;
                    }
                }
                if (rule.search == domainHost)
                    return {
                        match: true,
                        rule: rule
                    };
                break;

            case CompiledProxyRuleType.SearchDomainSubdomain:

                if (domainHost == null) {
                    domainHost = Utils.extractHostFromUrl(url);
                    if (domainHost == null) {
                        break;
                    }
                }
                // domain
                if (domainHost == rule.search)
                    return {
                        match: true,
                        rule: rule
                    };

                // subdomains
                if (domainHost.endsWith('.' + rule.search))
                    return {
                        match: true,
                        rule: rule
                    };

                break;

            case CompiledProxyRuleType.SearchDomainAndPath:

                if (schemaLessUrl == null) {
                    schemaLessUrl = Utils.removeSchemaFromUrl(url);
                    if (schemaLessUrl == null) {
                        break;
                    }
                }

                if (schemaLessUrl.startsWith(rule.search))
                    return {
                        match: true,
                        rule: rule
                    };

                break;

            case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

                if (schemaLessUrl == null) {
                    schemaLessUrl = Utils.removeSchemaFromUrl(url);
                    if (schemaLessUrl == null) {
                        break;
                    }
                }

                if (schemaLessUrl.startsWith(rule.search))
                    return {
                        match: true,
                        rule: rule
                    };

                let ruleSearchHost = Utils.extractHostFromInvalidUrl(rule.search);
                if (ruleSearchHost != null) {

                    if (domainHost == null) {
                        domainHost = Utils.extractHostFromUrl(url);
                        if (domainHost == null) {
                            break;
                        }
                    }

                    // should be the same
                    if (ruleSearchHost != domainHost)
                        break;

                    // after this state, we are sure that the url is for the same domain, now just checking the path
                }

                // subdomains
                if (schemaLessUrl.includes('.' + rule.search))
                    return {
                        match: true,
                        rule: rule
                    };
                break;
        }
        return {
            match: false,
            rule: null
        }
    }

    static timer() {
        var start = new Date();
        var time;
        return {
            time: time,
            stop: function () {
                var end = new Date();
                var time = end.getTime() - start.getTime();
                this.time = time;
                //console.log('Timer:', name, 'finished in', time, 'ms');
            }
        }
    };
}