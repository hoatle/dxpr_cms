# DXPR CMS

DXPR CMS is a powerful and enhanced version of Drupal 10, incorporating some of the best modules and themes available. It is designed to help you quickly set up and start building your site. Unlike traditional distributions, DXPR CMS utilizes the Drupal recipe system, ensuring flexibility and ease of customization.

## Features

- **Enhanced Drupal 10**: Supercharged with carefully selected modules and themes.
- **Easy Setup**: Get your site up and running quickly.
- **Flexibility**: Built on the Drupal recipe system, allowing for easy customization and avoiding lock-in.

## Installation

Follow these steps to install DXPR CMS:

1. Clone the repository and navigate to the project directory.
2. Run the following command:

    ```bash
    $ ddev install
    ```

3. Once the installation is complete, your browser will automatically open the DXPR CMS site.
4. Log in with the following credentials:
  - **Username**: admin
  - **Password**: admin

## Adding New Recipes

If you want to install new recipes after the site is up and running, use the following commands:

1. To install the DXPR Builder recipe:

    ```bash
    $ ddev php core/scripts/drupal recipe ../recipes/dxpr_builder
    ```

2. To install the Multilingual recipe:

    ```bash
    $ ddev php core/scripts/drupal recipe ../recipes/dxpr_cms_multilingual
    ```

## Support

For support and further information, please visit our [website](https://dxpr.com).

