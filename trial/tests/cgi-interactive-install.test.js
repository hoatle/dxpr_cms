import {describe, it, expect, afterEach, beforeEach} from 'vitest'
import fs from "node:fs";
import {
  createPhp,
  runPhpCode,
  assertOutput,
  rootPath,
  setupFixturePaths,
  cleanupFixturePaths,
  writeFlavorTxt,
  copyArtifactFixture,
  createCgiPhp,
  doRequest,
  copyExistingBuildFixture, checkForMetaRefresh, assertLocationHeader, assertSitesDefaultDirectoryPermissions
} from './utils'

/**
 * Tests the interactive installation.
 *
 * Added as a separate function to support the default artifact test and debug from source test.
 *
 * @param configFixturePath
 * @param persistFixturePath
 * @returns {Promise<void>}
 */
async function testInteractiveInstall(configFixturePath, persistFixturePath) {
  let location;
  const [cgiOut, cgiErr, phpCgi] = createCgiPhp({ configFixturePath, persistFixturePath });

  // Visit the Drupal site to kick off installation, verify it redirects to `core/install.php`.
  const [initResponse, initText] = await doRequest(phpCgi, '/cgi/drupal')
  assertOutput(cgiOut, 'GET /cgi/drupal 302')
  assertOutput(cgiErr, '')
  assertLocationHeader(initResponse, '/cgi/drupal/core/install.php', '')
  expect(initText).toContain('Redirecting to /cgi/drupal/core/install.php')

  // Submit and skip the first form, which is recipe selection.
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
  location = assertLocationHeader(
    postRecipesRes,
    '/cgi/drupal/core/install.php',
    '?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms'
  )
  expect(postRecipesText).toContain('Redirecting to http://localhost:3000/cgi/drupal/core/install.php')

  // Submit the form which sets the site's name.
  const [, siteNameFormText, siteNameFormDoc] = await doRequest(phpCgi, location.pathname + location.search)
  expect(siteNameFormText).toContain('<title>Give your site a name | DXPR CMS</title>')
  const [postSiteNameFormRes, postSiteNameText,] = await doRequest(
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
  location = assertLocationHeader(
    postSiteNameFormRes,
    '/cgi/drupal/core/install.php',
    '?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms&site_name=Node%20test'
  )
  expect(postSiteNameText).toContain('Redirecting to http://localhost:3000/cgi/drupal/core/install.php')

  const [initiateBatchRes] = await doRequest(phpCgi, location.pathname + location.search)
  location = assertLocationHeader(
    initiateBatchRes,
    '/cgi/drupal/core/install.php',
    '?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms&site_name=Node%20test&id=1&op=start'
  )

  // Follow the batch process which installs recipes.
  const [metaRefreshRes, metaRefreshText, metaRefreshDoc] = await doRequest(phpCgi, location.pathname + location.search)
  expect(metaRefreshDoc.title).toStrictEqual('Setting up your site | DXPR CMS')

  const [checkedRes] = await checkForMetaRefresh(phpCgi, metaRefreshRes, metaRefreshText, metaRefreshDoc)

  location = assertLocationHeader(
    checkedRes,
    '/cgi/drupal/core/install.php',
    '?profile=dxpr_cms_installer&langcode=en&recipes%5B0%5D=dxpr_cms&site_name=Node%20test'
  )
  const [finishedRes, , ] = await doRequest(phpCgi, location.pathname + location.search)
  assertLocationHeader(
    finishedRes,
    '/cgi/drupal//admin/dashboard/welcome',
    ''
  )

  // @todo visit directly, not sure why double `/`.
  const [, text, doc] = await doRequest(phpCgi, '/cgi/drupal/admin/dashboard/welcome')
  expect(doc.title).toStrictEqual('Dashboard | Node test')

  // Verify CSS/JS aggregation turned off
  expect(text).toContain('cgi/drupal/themes/contrib/gin/dist/css')
  expect(text).toContain('cgi/drupal/themes/contrib/gin/dist/js')

  assertSitesDefaultDirectoryPermissions(persistFixturePath)
}

describe('interactive install', {timeout: 270000}, () => {
  beforeEach(setupFixturePaths)
  afterEach(cleanupFixturePaths)

  it('interactively installs the site from the artifact', async ({ configFixturePath, persistFixturePath }) => {
    writeFlavorTxt(configFixturePath, 'drupal')
    copyArtifactFixture(persistFixturePath, 'trial.zip')

    const [stdOut, stdErr, php] = await createPhp({ configFixturePath, persistFixturePath })
    await runPhpCode(php, rootPath + '/public/assets/init.phpcode')
    expect(stdOut.pop().trim()).toStrictEqual('{"message":"Unpacking files 100%","type":"unarchive"}')
    assertOutput(stdErr, '')

    await testInteractiveInstall(configFixturePath, persistFixturePath)
  })

  it.skipIf(!fs.existsSync(`${rootPath}/build`))('interactive install from source [debug job]', async ({ configFixturePath, persistFixturePath }) => {
    copyExistingBuildFixture(persistFixturePath)
    expect(fs.existsSync(`${persistFixturePath}/drupal`)).toBe(true)

    await testInteractiveInstall(configFixturePath, persistFixturePath)
  })
})
