import {describe, it, expect, afterEach, beforeEach} from 'vitest'
import fs from "node:fs";
import {
  createPhp,
  runPhpCode,
  assertOutput,
  rootPath,
  rootFixturePath,
  setupFixturePaths,
  cleanupFixturePaths,
  writeFlavorTxt,
  copyArtifactFixture,
  createCgiPhp,
  doRequest,
  writeInstallParams,
  copyExistingBuildFixture, checkForMetaRefresh
} from './utils'

function assertSitesDefaultDirectoryPermissions(persistFixturePath) {
  const stat = fs.statSync(`${persistFixturePath}/drupal/web/sites/default`)
  expect(stat.mode & 0o777).toStrictEqual(0o755)

  const statSettings = fs.statSync(`${persistFixturePath}/drupal/web/sites/default/settings.php`)
  expect(statSettings.mode & 0o777).toStrictEqual(0o644)
}

describe('install-site.phpcode', {timeout: 270000}, () => {
  beforeEach(setupFixturePaths)
  afterEach(cleanupFixturePaths)

  it('installs the site from the artifact', async ({ configFixturePath, persistFixturePath }) => {
    writeFlavorTxt(configFixturePath, 'drupal')
    writeInstallParams(configFixturePath, {
      langcode: 'en',
      skip: false,
      siteName: 'DXPR CMS Test',
      profile: 'dxpr_cms_installer',
      recipes: ['dxpr_cms', 'dxpr_cms_multilingual'],
      host: globalThis.location.host,
    })
    copyArtifactFixture(persistFixturePath, 'trial.zip')

    const [stdOut, stdErr, php] = createPhp({ configFixturePath, persistFixturePath })
    await php.binary
    await php.run(`<?php putenv('dxpr_cms_TRIAL=1');`)

    await runPhpCode(php, rootPath + '/public/assets/init.phpcode')

    expect(stdOut.pop().trim()).toStrictEqual('{"message":"Unpacking files 100%","type":"unarchive"}')
    assertOutput(stdErr, '')
    stdOut.length = 0;

    expect(fs.existsSync(`${persistFixturePath}/drupal`)).toBe(true)

    await runPhpCode(php, rootPath + '/public/assets/install-site.phpcode')
    const lastMessage = stdOut.pop().trim();
    expect(lastMessage).toEqual('{"message":"Performing install task (15 \\/ 15)","type":"install"}')
    assertOutput(stdErr, '')
    stdOut.length = 0;

    await runPhpCode(php, rootPath + '/public/assets/login-admin.phpcode')
    const loginOutput = JSON.parse(stdOut.join('').trim());
    expect(loginOutput).toHaveProperty('type')
    expect(loginOutput.type).toStrictEqual('set_cookie')
    expect(loginOutput).toHaveProperty('params')
    expect(loginOutput.params).toHaveProperty('name')
    expect(loginOutput.params).toHaveProperty('id')
    assertOutput(stdErr, '')
    stdOut.length = 0;

    assertSitesDefaultDirectoryPermissions(persistFixturePath)

    const [cgiOut, cgiErr, phpCgi] = createCgiPhp({ configFixturePath, persistFixturePath });
    phpCgi.cookies.set(loginOutput.params.name, loginOutput.params.id)

    const [response, text] = await doRequest(phpCgi, '/cgi/drupal')
    assertOutput(cgiOut, 'GET /cgi/drupal 200')
    assertOutput(cgiErr, '')

    expect(response.headers.get('x-generator')).toMatch(/Drupal \d+ \(https:\/\/www\.drupal\.org\)/)

    // Assert custom site title.
    expect(text).toContain('<title>| DXPR CMS Test</title>')
    // Verify CSS/JS aggregation turned off
    expect(text).toContain('cgi/drupal/core/themes/olivero/css')
    expect(text).toContain('cgi/drupal/core/themes/olivero/js')

    expect(text).toContain('Starshot: a journey beyond the horizon')

    expect(text).toContain('/cgi/drupal/user/logout')
  })
  it('interactively installs the site from the artifact', async ({ configFixturePath, persistFixturePath }) => {
    writeFlavorTxt(configFixturePath, 'drupal')
    copyArtifactFixture(persistFixturePath, 'trial.zip')

    const [stdOut, stdErr, php] = createPhp({ configFixturePath, persistFixturePath })
    await runPhpCode(php, rootPath + '/public/assets/init.phpcode')
    expect(stdOut.pop().trim()).toStrictEqual('{"message":"Unpacking files 100%","type":"unarchive"}')
    assertOutput(stdErr, '')

    let location;
    const [cgiOut, cgiErr, phpCgi] = createCgiPhp({ configFixturePath, persistFixturePath });

    const [initResponse, initText] = await doRequest(phpCgi, '/cgi/drupal')
    assertOutput(cgiOut, 'GET /cgi/drupal 302')
    assertOutput(cgiErr, '')
    expect(initResponse.headers.get('location'), '/cgi/drupal/core/install.php')
    expect(initText).toContain('Redirecting to /cgi/drupal/core/install.php')

    const [, , recipesFormDoc] = await doRequest(phpCgi, '/cgi/drupal/core/install.php')
    expect(recipesFormDoc.title).toStrictEqual('What are your top goals? | DXPR CMS')
    const [postRecipesRes, postRecipesText,] = await doRequest(
      phpCgi,
      '/cgi/drupal/core/install.php',
      'POST',
      {
        form_build_id: recipesFormDoc.querySelector('input[name="form_build_id"]').value,
        form_id: recipesFormDoc.querySelector('input[name="form_id"]').value,
        op: 'Skip this step'
      }
    )
    location = new URL(postRecipesRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal/core/install.php')
    expect(location.search).toStrictEqual('?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms')
    expect(postRecipesText).toContain('Redirecting to http://localhost:3000/cgi/drupal/core/install.php')

    const [, siteNameFormText, siteNameFormDoc] = await doRequest(phpCgi, location.pathname + location.search)
    expect(siteNameFormText).toContain('<title>Give your site a name | DXPR CMS</title>')

    const [postSiteNameFormRes, ,] = await doRequest(
      phpCgi,
      location.pathname + location.search,
      'POST',
      {
        site_name: 'Node test',
        form_build_id: siteNameFormDoc.querySelector('input[name="form_build_id"]').value,
        form_id: siteNameFormDoc.querySelector('input[name="form_id"]').value,
        op: siteNameFormDoc.querySelector('input[name="op"]').value
      }
    )
    location = new URL(postSiteNameFormRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal/core/install.php')
    expect(location.search).toStrictEqual('?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms&site_name=Node%20test')

    const [, , databaseConfigDocument] = await doRequest(phpCgi, location.pathname + location.search)
    expect(databaseConfigDocument.title).toStrictEqual('Database configuration | DXPR CMS')

    location = new URL(postSiteNameFormRes.headers.get('location'))
    const [postDbConfigRes, postDbConfigText] = await doRequest(
      phpCgi,
      location.pathname + location.search,
      'POST',
      {
        form_build_id: databaseConfigDocument.querySelector('input[name="form_build_id"]').value,
        form_id: databaseConfigDocument.querySelector('input[name="form_id"]').value,
        op: databaseConfigDocument.querySelector('input[name="op"]').value
      }
    )
    location = new URL(postDbConfigRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal/core/install.php')
    expect(postDbConfigText).toContain('Redirecting to http://localhost:3000/cgi/drupal/core/install.php')

    const [metaRefreshRes, metaRefreshText, metaRefreshDoc] = await doRequest(phpCgi, location.pathname + location.search)
    expect(metaRefreshDoc.title).toStrictEqual('Setting up your site | DXPR CMS')

    const [checkedRes] = await checkForMetaRefresh(phpCgi, metaRefreshRes, metaRefreshText, metaRefreshDoc)

    location = new URL(checkedRes.headers.get('location'))
    const [finishedRes, , ] = await doRequest(phpCgi, location.pathname + location.search)
    location = new URL(finishedRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal//admin/dashboard/welcome')

    // @todo visit directly, not sure why double `/`.
    const [, text, doc] = await doRequest(phpCgi, '/cgi/drupal/admin/dashboard/welcome')
    expect(doc.title).toStrictEqual('Dashboard | Node test')

    // Verify CSS/JS aggregation turned off
    expect(text).toContain('cgi/drupal/themes/contrib/gin/dist/css')
    expect(text).toContain('cgi/drupal/themes/contrib/gin/dist/js')

    assertSitesDefaultDirectoryPermissions(persistFixturePath)
  })
  it.skipIf(!fs.existsSync(`${rootFixturePath}/dxpr-cms`))('install-site from source [debug job]', async ({ configFixturePath, persistFixturePath }) => {
    writeFlavorTxt(configFixturePath, 'drupal')
    writeInstallParams(configFixturePath, {
      langcode: 'en',
      skip: false,
      siteName: 'test install',
      profile: 'dxpr_cms_installer',
      recipes: ['dxpr_cms', 'dxpr_cms_multilingual'],
      host: globalThis.location.host,
    })
    copyExistingBuildFixture(persistFixturePath, 'dxpr-cms')
    expect(fs.existsSync(`${persistFixturePath}/drupal`)).toBe(true)

    const [stdOut, stdErr, php] = createPhp({ configFixturePath, persistFixturePath })
    await runPhpCode(php, rootPath + '/public/assets/install-site.phpcode')
    const lastMessage = stdOut.pop().trim();
    expect(lastMessage).toEqual('{"message":"Performing install task (13 \\/ 13)","type":"install"}')
    assertOutput(stdErr, '')
    stdOut.length = 0;

    await runPhpCode(php, rootPath + '/public/assets/login-admin.phpcode')
    const loginOutput = JSON.parse(stdOut.join('').trim());
    expect(loginOutput).toHaveProperty('type')
    expect(loginOutput.type).toStrictEqual('set_cookie')
    expect(loginOutput).toHaveProperty('params')
    expect(loginOutput.params).toHaveProperty('name')
    expect(loginOutput.params).toHaveProperty('id')
    assertOutput(stdErr, '')
    stdOut.length = 0;

    assertSitesDefaultDirectoryPermissions(persistFixturePath)

    const [cgiOut, cgiErr, phpCgi] = createCgiPhp({ configFixturePath, persistFixturePath });
    phpCgi.cookies.set(loginOutput.params.name, loginOutput.params.id)

    const [, text] = await doRequest(phpCgi, '/cgi/drupal')
    assertOutput(cgiOut, 'GET /cgi/drupal 200')
    assertOutput(cgiErr, '')
    expect(text).toContain('<title>| test install</title>')
    expect(text).toContain('/cgi/drupal/user/logout')
  })
  it.skipIf(!fs.existsSync(`${rootFixturePath}/dxpr-cms`))('interactive install from source [debug job]', async ({ configFixturePath, persistFixturePath }) => {
    copyExistingBuildFixture(persistFixturePath, 'dxpr-cms')
    expect(fs.existsSync(`${persistFixturePath}/drupal`)).toBe(true)

    let location;
    const [cgiOut, cgiErr, phpCgi] = createCgiPhp({ configFixturePath, persistFixturePath });

    const [initResponse, initText] = await doRequest(phpCgi, '/cgi/drupal')
    assertOutput(cgiOut, 'GET /cgi/drupal 302')
    assertOutput(cgiErr, '')
    expect(initResponse.headers.get('location'), '/cgi/drupal/core/install.php')
    expect(initText).toContain('Redirecting to /cgi/drupal/core/install.php')

    const [, , recipesFormDoc] = await doRequest(phpCgi, '/cgi/drupal/core/install.php')
    expect(recipesFormDoc.title).toStrictEqual('What are your top goals? | DXPR CMS')
    const [postRecipesRes, postRecipesText,] = await doRequest(
      phpCgi,
      '/cgi/drupal/core/install.php',
      'POST',
      {
        form_build_id: recipesFormDoc.querySelector('input[name="form_build_id"]').value,
        form_id: recipesFormDoc.querySelector('input[name="form_id"]').value,
        op: 'Skip this step'
      }
    )
    location = new URL(postRecipesRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal/core/install.php')
    expect(location.search).toStrictEqual('?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms')
    expect(postRecipesText).toContain('Redirecting to http://localhost:3000/cgi/drupal/core/install.php')

    const [, siteNameFormText, siteNameFormDoc] = await doRequest(phpCgi, location.pathname + location.search)
    expect(siteNameFormText).toContain('<title>Give your site a name | DXPR CMS</title>')

    const [postSiteNameFormRes, ,] = await doRequest(
      phpCgi,
      location.pathname + location.search,
      'POST',
      {
        site_name: 'Node test',
        form_build_id: siteNameFormDoc.querySelector('input[name="form_build_id"]').value,
        form_id: siteNameFormDoc.querySelector('input[name="form_id"]').value,
        op: siteNameFormDoc.querySelector('input[name="op"]').value
      }
    )
    location = new URL(postSiteNameFormRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal/core/install.php')
    expect(location.search).toStrictEqual('?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms&site_name=Node%20test')

    const [, , databaseConfigDocument] = await doRequest(phpCgi, location.pathname + location.search)
    expect(databaseConfigDocument.title).toStrictEqual('Database configuration | DXPR CMS')

    location = new URL(postSiteNameFormRes.headers.get('location'))
    const [postDbConfigRes, postDbConfigText] = await doRequest(
      phpCgi,
      location.pathname + location.search,
      'POST',
      {
        form_build_id: databaseConfigDocument.querySelector('input[name="form_build_id"]').value,
        form_id: databaseConfigDocument.querySelector('input[name="form_id"]').value,
        op: databaseConfigDocument.querySelector('input[name="op"]').value
      }
    )
    location = new URL(postDbConfigRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal/core/install.php')
    expect(postDbConfigText).toContain('Redirecting to http://localhost:3000/cgi/drupal/core/install.php')

    const [metaRefreshRes, metaRefreshText, metaRefreshDoc] = await doRequest(phpCgi, location.pathname + location.search)
    expect(metaRefreshDoc.title).toStrictEqual('Setting up your site | DXPR CMS')

    const [checkedRes] = await checkForMetaRefresh(phpCgi, metaRefreshRes, metaRefreshText, metaRefreshDoc)

    location = new URL(checkedRes.headers.get('location'))
    const [finishedRes, , ] = await doRequest(phpCgi, location.pathname + location.search)
    location = new URL(finishedRes.headers.get('location'))
    expect(location.pathname).toStrictEqual('/cgi/drupal//admin/dashboard/welcome')

    // @todo visit directly, not sure why double `/`.
    const [, , doc] = await doRequest(phpCgi, '/cgi/drupal/admin/dashboard/welcome')
    expect(doc.title).toStrictEqual('Dashboard | Node test')

    assertSitesDefaultDirectoryPermissions(persistFixturePath)
  })
})
